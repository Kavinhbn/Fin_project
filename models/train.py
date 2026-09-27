"""Train and compare models on NHANES; hold out the newest cycle (2017-2018) as the test set.

Usage: .venv\\Scripts\\python -m models.train [--trials 20] [--boot 500]
Outputs: reports/metrics.json, models/artifacts/{mode}/cascade.joblib, reports/best_params.json
"""
from __future__ import annotations

import argparse
import json
import logging
import time
from pathlib import Path

import joblib
import numpy as np
import optuna
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.base import BaseEstimator
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from common.config import SEED, TARGETS, set_global_seed
from common.schemas import FeatureMode
from data_preprocessing.features import select_features
from data_preprocessing.nhanes import TEST_CYCLE, build_dataset, quality_report
from data_preprocessing.selection import boruta_select
from models.cascade import CascadeModel, IndependentModel, smote_xgb_factory, xgb_factory
from models.evaluate import choose_thresholds, full_report

log = logging.getLogger("train")
REPORTS = Path("reports")
ARTIFACTS = Path("models/artifacts")
N_STACK_FOLDS = 5


def split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Temporal split: the newest cycle is the untouched test set."""
    return df[df["CYCLE"] != TEST_CYCLE].reset_index(drop=True), df[df["CYCLE"] == TEST_CYCLE].reset_index(drop=True)


def tune_xgb(train: pd.DataFrame, trials: int) -> dict[str, float]:
    """Bayesian (TPE) search over the requested XGBoost parameters, mean 3-fold AUROC over heads."""
    from sklearn.metrics import roc_auc_score

    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=SEED)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "max_depth": trial.suggest_int("max_depth", 2, 6),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "n_estimators": trial.suggest_int("n_estimators", 100, 500),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 20),
        }
        aucs = []
        for t in TARGETS:
            cols = [c for c in select_features(t, "strict") if c in train.columns]
            p = cross_val_predict(xgb_factory(params)(), train[cols], train[t], cv=cv, method="predict_proba")[:, 1]
            aucs.append(roc_auc_score(train[t], p))
        return float(np.mean(aucs))

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=SEED))
    study.optimize(objective, n_trials=trials)
    log.info("best CV macro-AUROC %.4f params %s", study.best_value, study.best_params)
    return {**study.best_params, "cv_macro_auroc": study.best_value}


def rf_factory() -> BaseEstimator:
    return make_pipeline(SimpleImputer(strategy="median"),
                         RandomForestClassifier(n_estimators=300, min_samples_leaf=10, n_jobs=-1, random_state=SEED))


def lr_factory() -> BaseEstimator:
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(max_iter=1000))


def lgbm_factory() -> BaseEstimator:
    return LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=15, min_child_samples=20,
                          subsample=0.8, colsample_bytree=0.8, random_state=SEED, verbose=-1, n_jobs=-1)


def cb_factory() -> BaseEstimator:
    from catboost import CatBoostClassifier
    return CatBoostClassifier(iterations=300, depth=4, learning_rate=0.05, random_seed=SEED, verbose=False,
                              allow_writing_files=False)


def stack_ensemble(oofs: dict[str, pd.DataFrame], preds: dict[str, pd.DataFrame],
                   Ytr: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Logistic-regression meta-learner over other models' out-of-fold probabilities (train) /
    held-out probabilities (test), per target. `oofs`/`preds` map model name -> DataFrame of
    per-target probabilities; every model must cover the same targets and row order.

    Returns (train_oof, test_pred): `train_oof` is itself out-of-fold (5-fold CV of the
    meta-learner on the base models' OOF matrix) so it can be used to pick a decision threshold
    without ever looking at the test set.
    """
    from sklearn.linear_model import LogisticRegression as LR

    cv = StratifiedKFold(n_splits=N_STACK_FOLDS, shuffle=True, random_state=SEED)
    train_oof: dict[str, np.ndarray] = {}
    test_pred: dict[str, np.ndarray] = {}
    for t in TARGETS:
        Xtr = pd.DataFrame({name: oof[t] for name, oof in oofs.items()})
        Xte = pd.DataFrame({name: pred[t] for name, pred in preds.items()})
        train_oof[t] = cross_val_predict(LR(), Xtr, Ytr[t], cv=cv, method="predict_proba")[:, 1]
        test_pred[t] = LR().fit(Xtr, Ytr[t]).predict_proba(Xte)[:, 1]
    return pd.DataFrame(train_oof), pd.DataFrame(test_pred)


def boruta_columns(mode: FeatureMode, train: pd.DataFrame) -> dict[str, list[str]]:
    """Boruta-confirmed columns per target, run once on the training partition only (never
    the test set) — the same leakage boundary as the hyperparameter search."""
    cols: dict[str, list[str]] = {}
    for t in TARGETS:
        allowed = [c for c in select_features(t, "strict") if c in train.columns]
        kept = boruta_select(train[allowed], train[t].astype(int))
        log.info("Boruta/%s kept %d/%d: %s", t, len(kept), len(allowed), kept)
        cols[t] = kept
    return cols


def run_mode(mode: FeatureMode, train: pd.DataFrame, test: pd.DataFrame, params: dict[str, float], boot: int) -> dict[str, object]:
    feats = train.columns
    Ytr, Yte = train[list(TARGETS)].astype(int), test[list(TARGETS)].astype(int)
    clean_params = {k: v for k, v in params.items() if k != "cv_macro_auroc"}
    xgb = xgb_factory(clean_params)
    models: dict[str, object] = {
        "logistic_regression": IndependentModel(lr_factory, mode, calibrate=False),
        "random_forest": IndependentModel(rf_factory, mode),
        "lightgbm": IndependentModel(lgbm_factory, mode),
        "catboost": IndependentModel(cb_factory, mode),
        "xgboost_independent": IndependentModel(xgb, mode),
        "xgboost_cascade": CascadeModel(xgb, mode),
    }
    if mode == "strict":  # Boruta/SMOTE variant is evaluated against the honest, leakage-free features
        models["xgboost_boruta_smote"] = IndependentModel(
            smote_xgb_factory(clean_params), mode, columns_override=boruta_columns(mode, train))
    results: dict[str, object] = {}
    oofs: dict[str, pd.DataFrame] = {}
    preds: dict[str, pd.DataFrame] = {}
    for name, model in models.items():
        t0 = time.time()
        model.fit(train[feats], Ytr)
        thresholds = choose_thresholds(Ytr, model.oof_)
        pred = model.predict_proba(test[feats])
        results[name] = full_report(Yte, pred, thresholds, boot)
        log.info("%s/%s macro AUROC %.4f (%.0fs)", mode, name, results[name]["multilabel"]["macro_auroc"], time.time() - t0)
        if name in ("random_forest", "lightgbm", "catboost", "xgboost_independent"):
            oofs[name], preds[name] = model.oof_, pred
        if name == "xgboost_cascade":
            out = ARTIFACTS / mode
            out.mkdir(parents=True, exist_ok=True)
            joblib.dump({"model": model, "thresholds": thresholds}, out / "cascade.joblib")

    t0 = time.time()
    stack_oof, stack_pred = stack_ensemble(oofs, preds, Ytr)
    stack_thresholds = choose_thresholds(Ytr, stack_oof)
    results["stacking_ensemble"] = full_report(Yte, stack_pred, stack_thresholds, boot)
    log.info("%s/stacking_ensemble macro AUROC %.4f (%.0fs)", mode, results["stacking_ensemble"]["multilabel"]["macro_auroc"], time.time() - t0)
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=20)
    parser.add_argument("--boot", type=int, default=500)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    set_global_seed()
    df = build_dataset()
    train, test = split(df)
    log.info("train %d rows, test %d rows (cycle %s)", len(train), len(test), TEST_CYCLE)
    params = tune_xgb(train, args.trials)
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "best_params.json").write_text(json.dumps(params, indent=1))
    metrics = {
        "data": quality_report(df),
        "test_cycle": TEST_CYCLE,
        "modes": {m: run_mode(m, train, test, params, args.boot) for m in ("strict", "full")},
    }
    (REPORTS / "metrics.json").write_text(json.dumps(metrics, indent=1))
    log.info("wrote reports/metrics.json")


if __name__ == "__main__":
    main()
