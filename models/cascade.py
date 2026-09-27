"""Multi-label models over NHANES features: independent baselines and the disease cascade.

The cascade is a classifier chain on a clinician-specified graph:
    shared risk factors -> Diabetes, Hypertension -> CVD
The CVD head receives the (out-of-fold, calibrated) Diabetes and Hypertension probabilities as
extra inputs, so the model learns that the conditions feed into each other. Every head only
sees the features allowed for it (see data_preprocessing.features), which controls leakage.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, clone
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from xgboost import XGBClassifier

from common.config import SEED, TARGETS
from common.schemas import FeatureMode
from data_preprocessing.features import select_features

Factory = Callable[[], BaseEstimator]
MEDIATORS: tuple[str, str] = ("p_diabetes", "p_hypertension")
N_FOLDS = 5

DEFAULT_XGB_PARAMS: dict[str, Any] = {
    "n_estimators": 300, "max_depth": 3, "learning_rate": 0.05, "subsample": 0.8,
    "colsample_bytree": 0.8, "min_child_weight": 5, "reg_lambda": 1.0,
}


class XGBFactory:
    """Picklable XGBoost factory (a closure could not be saved with joblib)."""

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        self.params = {**DEFAULT_XGB_PARAMS, **(params or {})}

    def __call__(self) -> BaseEstimator:
        return XGBClassifier(**self.params, tree_method="hist", n_jobs=-1, random_state=SEED, eval_metric="logloss")


def xgb_factory(params: dict[str, Any] | None = None) -> Factory:
    """XGBoost factory with fixed seed; NaNs are handled natively."""
    return XGBFactory(params)


class SmoteXGBFactory:
    """Median-impute -> SMOTE oversample -> XGBoost, as an imblearn Pipeline.

    imblearn's Pipeline only resamples during `fit`; `predict_proba` on new data just imputes
    and predicts, so the test/out-of-fold distribution is never touched. SMOTE needs complete
    rows, which is why this variant imputes first and so loses XGBoost's native NaN handling;
    plain `xgb_factory` is used everywhere else for that reason.
    """

    def __init__(self, params: dict[str, Any] | None = None, k_neighbors: int = 5) -> None:
        self.params = {**DEFAULT_XGB_PARAMS, **(params or {})}
        self.k_neighbors = k_neighbors

    def __call__(self) -> BaseEstimator:
        from imblearn.over_sampling import SMOTE
        from imblearn.pipeline import Pipeline
        from sklearn.impute import SimpleImputer

        clf = XGBClassifier(**self.params, tree_method="hist", n_jobs=-1, random_state=SEED, eval_metric="logloss")
        return Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("smote", SMOTE(random_state=SEED, k_neighbors=self.k_neighbors)),
            ("clf", clf),
        ])


def smote_xgb_factory(params: dict[str, Any] | None = None, k_neighbors: int = 5) -> Factory:
    """SMOTE-balanced XGBoost factory. Combine with `columns_override` from Boruta selection."""
    return SmoteXGBFactory(params, k_neighbors)


def _oof(est: BaseEstimator, X: pd.DataFrame, y: pd.Series) -> np.ndarray:
    """Out-of-fold positive-class probabilities (stratified, seeded)."""
    cv = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)
    return cross_val_predict(clone(est), X, y, cv=cv, method="predict_proba")[:, 1]


def _cols(target: str, mode: FeatureMode, available: pd.Index) -> list[str]:
    return [c for c in select_features(target, mode) if c in available]


class IndependentModel:
    """One independent binary classifier per label (baseline; ignores label dependence)."""

    def __init__(self, factory: Factory, mode: FeatureMode = "strict", calibrate: bool = True,
                 columns_override: dict[str, list[str]] | None = None) -> None:
        self.factory, self.mode, self.calibrate = factory, mode, calibrate
        self.columns_override = columns_override
        self.estimators_: dict[str, BaseEstimator] = {}
        self.calibrators_: dict[str, IsotonicRegression] = {}
        self.columns_: dict[str, list[str]] = {}
        self.oof_: pd.DataFrame | None = None

    def fit(self, X: pd.DataFrame, Y: pd.DataFrame) -> IndependentModel:
        oof: dict[str, np.ndarray] = {}
        for t in TARGETS:
            cols = self.columns_override[t] if self.columns_override else _cols(t, self.mode, X.columns)
            self.columns_[t] = cols
            est = self.factory()
            raw = _oof(est, X[cols], Y[t])
            if self.calibrate:
                self.calibrators_[t] = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(raw, Y[t])
                raw = self.calibrators_[t].predict(raw)
            oof[t] = raw
            self.estimators_[t] = clone(est).fit(X[cols], Y[t])
        self.oof_ = pd.DataFrame(oof, index=X.index)
        return self

    def predict_proba(self, X: pd.DataFrame) -> pd.DataFrame:
        out: dict[str, np.ndarray] = {}
        for t in TARGETS:
            p = self.estimators_[t].predict_proba(X[self.columns_[t]])[:, 1]
            out[t] = self.calibrators_[t].predict(p) if t in self.calibrators_ else p
        return pd.DataFrame(out, index=X.index)


class CascadeModel:
    """Classifier chain: Diabetes and Hypertension heads feed the CVD head."""

    def __init__(self, factory: Factory, mode: FeatureMode = "strict") -> None:
        self.factory, self.mode = factory, mode
        self.level1_: dict[str, BaseEstimator] = {}
        self.calibrators_: dict[str, IsotonicRegression] = {}
        self.columns_: dict[str, list[str]] = {}
        self.cvd_model_: BaseEstimator | None = None
        self.cvd_calibrator_: IsotonicRegression | None = None
        self.oof_: pd.DataFrame | None = None

    @property
    def cvd_columns(self) -> list[str]:
        return [*self.columns_["cvd"], *MEDIATORS]

    def fit(self, X: pd.DataFrame, Y: pd.DataFrame) -> CascadeModel:
        oof: dict[str, np.ndarray] = {}
        for t in ("diabetes", "hypertension"):
            cols = _cols(t, self.mode, X.columns)
            self.columns_[t] = cols
            est = self.factory()
            raw = _oof(est, X[cols], Y[t])
            self.calibrators_[t] = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(raw, Y[t])
            oof[t] = self.calibrators_[t].predict(raw)
            self.level1_[t] = clone(est).fit(X[cols], Y[t])
        self.columns_["cvd"] = _cols("cvd", self.mode, X.columns)
        Xc = X[self.columns_["cvd"]].copy()
        Xc[MEDIATORS[0]], Xc[MEDIATORS[1]] = oof["diabetes"], oof["hypertension"]
        est = self.factory()
        raw = _oof(est, Xc, Y["cvd"])
        self.cvd_calibrator_ = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(raw, Y["cvd"])
        oof["cvd"] = self.cvd_calibrator_.predict(raw)
        self.cvd_model_ = clone(est).fit(Xc, Y["cvd"])
        self.oof_ = pd.DataFrame(oof, index=X.index)[list(TARGETS)]
        return self

    def level1_proba(self, X: pd.DataFrame) -> pd.DataFrame:
        """Calibrated Diabetes/Hypertension probabilities (the mediators)."""
        out = {}
        for t, name in zip(("diabetes", "hypertension"), MEDIATORS, strict=True):
            p = self.level1_[t].predict_proba(X[self.columns_[t]])[:, 1]
            out[name] = self.calibrators_[t].predict(p)
        return pd.DataFrame(out, index=X.index)

    def cvd_frame(self, X: pd.DataFrame, mediators: pd.DataFrame | None = None) -> pd.DataFrame:
        """Input frame of the CVD head (features + mediator probabilities)."""
        m = self.level1_proba(X) if mediators is None else mediators
        frame = X[self.columns_["cvd"]].copy()
        frame[MEDIATORS[0]], frame[MEDIATORS[1]] = m[MEDIATORS[0]].to_numpy(), m[MEDIATORS[1]].to_numpy()
        return frame

    def predict_proba(self, X: pd.DataFrame) -> pd.DataFrame:
        if self.cvd_model_ is None or self.cvd_calibrator_ is None:
            raise RuntimeError("model is not fitted")
        m = self.level1_proba(X)
        raw = self.cvd_model_.predict_proba(self.cvd_frame(X, m))[:, 1]
        return pd.DataFrame({
            "diabetes": m[MEDIATORS[0]].to_numpy(),
            "hypertension": m[MEDIATORS[1]].to_numpy(),
            "cvd": self.cvd_calibrator_.predict(raw),
        }, index=X.index)
