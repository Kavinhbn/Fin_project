import numpy as np
import pandas as pd
import pytest

from common.config import TARGETS
from data_preprocessing.features import BASE_FEATURES, BP_FEATURES, GLUCOSE_FEATURES
from explainability.mediation import cascade_attribution, tree_drivers
from models.cascade import CascadeModel, IndependentModel, xgb_factory
from models.evaluate import best_f1_threshold, expected_calibration_error, full_report

SMALL = {"n_estimators": 40, "max_depth": 2}


def synthetic(n: int = 1200, seed: int = 0) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    cols = [*BASE_FEATURES, *GLUCOSE_FEATURES, *BP_FEATURES]
    X = pd.DataFrame(rng.normal(size=(n, len(cols))), columns=cols)
    X["SEX_MALE"] = rng.integers(0, 2, n).astype(float)
    dm = (X["BMXBMI"] + X["LBXGH"] + rng.normal(size=n) > 0.8).astype(int)
    htn = (X["RIDAGEYR"] + X["SBP_MEAN"] + rng.normal(size=n) > 0.5).astype(int)
    cvd = (0.8 * dm + 0.8 * htn + 0.5 * X["RIDAGEYR"] + rng.normal(size=n) > 1.2).astype(int)
    return X, pd.DataFrame({"diabetes": dm, "hypertension": htn, "cvd": cvd})


@pytest.fixture(scope="module")
def data():
    return synthetic()


@pytest.fixture(scope="module")
def cascade(data):
    X, Y = data
    return CascadeModel(xgb_factory(SMALL), "strict").fit(X, Y)


def test_cascade_predicts_valid_probabilities(cascade, data):
    X, _ = data
    P = cascade.predict_proba(X)
    assert list(P.columns) == list(TARGETS) and P.shape == (len(X), 3)
    assert ((P >= 0) & (P <= 1)).all().all()


def test_strict_mode_heads_never_see_label_defining_features(cascade):
    assert not set(cascade.columns_["diabetes"]) & set(GLUCOSE_FEATURES)
    assert not set(cascade.columns_["hypertension"]) & set(BP_FEATURES)
    assert {"p_diabetes", "p_hypertension"} <= set(cascade.cvd_frame(synthetic(50)[0]).columns)


def test_cascade_uses_mediators_for_cvd(data):
    X, Y = data
    m = CascadeModel(xgb_factory(SMALL), "strict").fit(X, Y)
    imp = dict(zip(m.cvd_columns, m.cvd_model_.feature_importances_, strict=True))
    assert imp["p_diabetes"] + imp["p_hypertension"] > 0.05


def test_deterministic_given_seed(data):
    X, Y = data
    a = CascadeModel(xgb_factory(SMALL), "strict").fit(X, Y).predict_proba(X.head(50))
    b = CascadeModel(xgb_factory(SMALL), "strict").fit(X, Y).predict_proba(X.head(50))
    pd.testing.assert_frame_equal(a, b)


def test_independent_model_and_oof(data):
    X, Y = data
    m = IndependentModel(xgb_factory(SMALL), "full").fit(X, Y)
    assert m.oof_ is not None and m.oof_.shape == (len(X), 3)
    assert set(GLUCOSE_FEATURES) <= set(m.columns_["diabetes"])  # full mode keeps them


def test_missing_values_are_handled(cascade, data):
    X, _ = data
    holed = X.head(20).copy()
    holed.loc[:, "LBDLDL"] = np.nan
    assert cascade.predict_proba(holed).notna().all().all()


def test_metrics_helpers():
    y = np.array([0, 0, 1, 1])
    assert expected_calibration_error(y, np.array([0.0, 0.0, 1.0, 1.0])) == 0.0
    assert 0.05 <= best_f1_threshold(y, np.array([0.1, 0.4, 0.6, 0.9])) <= 0.95


def test_full_report_shape(cascade, data):
    X, Y = data
    P = cascade.predict_proba(X)
    rep = full_report(Y, P, {t: 0.4 for t in TARGETS}, n_boot=20)
    assert set(rep["per_label"]) == set(TARGETS)
    assert 0 <= rep["multilabel"]["hamming_loss"] <= 1
    lo, hi = rep["bootstrap"]["macro_auroc"]["ci"]
    assert lo <= rep["multilabel"]["macro_auroc"] <= hi + 0.05


def test_mediation_shares_sum_to_one_and_tree_drivers(cascade, data):
    X, _ = data
    att = cascade_attribution(cascade, X.head(1), X.head(60), n_background=30)
    shares = att.shares()
    assert abs(sum(shares.values()) - 1) < 1e-9
    drivers = tree_drivers(cascade, X.head(1))
    assert set(drivers) == set(TARGETS)
    assert all(len(pos) <= 3 and len(neg) <= 3 for pos, neg in drivers.values())
