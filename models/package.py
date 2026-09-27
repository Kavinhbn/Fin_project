"""Fit the final cascade per feature mode and package everything the API needs.

Usage (after `python -m models.train` wrote reports/best_params.json and metrics.json):
    .venv\\Scripts\\python -m models.package
Artifact per mode: models/artifacts/<mode>/bundle.joblib. Model cards: reports/model_card_<mode>.json.
"""
from __future__ import annotations

import json
import logging
from typing import cast

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from common.config import SEED, TARGETS, set_global_seed
from common.schemas import BaselineRow, CalibrationPoint, Metric, ModelCard, SubgroupRow
from data_preprocessing.nhanes import build_dataset
from models.cascade import CascadeModel, xgb_factory
from models.conformal import ConformalSets
from models.evaluate import (
    bootstrap_ci,
    choose_thresholds,
    expected_calibration_error,
    multilabel_metrics,
)
from models.train import ARTIFACTS, REPORTS, split

log = logging.getLogger("package")
MODEL_VERSION = "xgb-cascade-nhanes-v1"
ALPHA = 0.1
RACE = {1: "Mexican American", 2: "Other Hispanic", 3: "Non-Hispanic White", 4: "Non-Hispanic Black", 5: "Other / multiracial"}


def _macro(Y: pd.DataFrame, P: pd.DataFrame, fn) -> float:
    return float(np.mean([fn(Y[t].to_numpy(), P[t].to_numpy()) for t in TARGETS]))


def subgroup_rows(test: pd.DataFrame, P: pd.DataFrame) -> list[SubgroupRow]:
    Y = test[list(TARGETS)].astype(int)
    masks: dict[str, pd.Series] = {
        "Female": test["SEX_MALE"] == 0, "Male": test["SEX_MALE"] == 1,
        "Age 20–39": test["RIDAGEYR"] < 40, "Age 40–64": (test["RIDAGEYR"] >= 40) & (test["RIDAGEYR"] < 65),
        "Age 65+": test["RIDAGEYR"] >= 65,
    }
    for code, name in RACE.items():
        masks[name] = test["RIDRETH1"] == code
    rows = []
    for group, m in masks.items():
        m = m.to_numpy()
        if m.sum() < 100 or any(Y[t][m].nunique() < 2 for t in TARGETS):
            continue  # too small to report reliably
        rows.append(SubgroupRow(group=group, n=int(m.sum()),
                                auroc=_macro(Y[m], P[m], roc_auc_score), ece=_macro(Y[m], P[m], expected_calibration_error)))
    return rows


def calibration_points(Y: pd.DataFrame, P: pd.DataFrame, bins: int = 10) -> list[CalibrationPoint]:
    """Pooled over the three conditions, equal-width bins; empty bins skipped."""
    y = np.concatenate([Y[t].to_numpy() for t in TARGETS])
    p = np.concatenate([P[t].to_numpy() for t in TARGETS])
    idx = np.clip((p * bins).astype(int), 0, bins - 1)
    return [CalibrationPoint(predicted=float(p[idx == b].mean()), observed=float(y[idx == b].mean()))
            for b in range(bins) if (idx == b).sum() >= 30]


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    p = k / n
    d = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / d
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return float(centre - half), float(centre + half)


def package_mode(mode: str, train: pd.DataFrame, test: pd.DataFrame, params: dict, metrics: dict) -> None:
    Ytr, Yte = train[list(TARGETS)].astype(int), test[list(TARGETS)].astype(int)
    model = CascadeModel(xgb_factory(params), mode).fit(train, Ytr)
    thresholds = choose_thresholds(Ytr, model.oof_)
    conformal = ConformalSets(ALPHA).fit(model.oof_, Ytr)
    P = model.predict_proba(test)
    ml = multilabel_metrics(Yte, P, thresholds)
    boot = bootstrap_ci(Yte, P, thresholds, 500)
    conf_eval = conformal.evaluate(P, Yte)
    cov = cast(dict[str, float], conf_eval["coverage_per_label"])
    mean_cov = float(np.mean(list(cov.values())))
    cov_ci = wilson(round(mean_cov * len(Yte) * len(TARGETS)), len(Yte) * len(TARGETS))
    ece_ci = [float(np.mean([boot[f"{t}_ece"]["ci"][i] for t in TARGETS])) for i in (0, 1)]
    baselines = [
        BaselineRow(model=name.replace("_", " ").title(), **{t: rep["per_label"][t]["auroc"] for t in TARGETS})
        for name, rep in metrics["modes"][mode].items()
    ]
    card = ModelCard(
        model_version=MODEL_VERSION, mode=mode,
        metrics=[
            Metric(label="Macro AUROC", value=ml["macro_auroc"], ci=tuple(boot["macro_auroc"]["ci"])),
            Metric(label="Macro F1", value=ml["macro_f1"], ci=tuple(boot["macro_f1"]["ci"])),
            Metric(label="Calibration error (ECE)", value=_macro(Yte, P, expected_calibration_error), ci=tuple(ece_ci)),
            Metric(label="Conformal coverage", value=mean_cov, ci=cov_ci),
        ],
        calibration=calibration_points(Yte, P), subgroups=subgroup_rows(test, P), baselines=baselines,
    )
    out = ARTIFACTS / mode
    out.mkdir(parents=True, exist_ok=True)
    background = train.sample(500, random_state=SEED)
    joblib.dump({"version": MODEL_VERSION, "mode": mode, "model": model, "thresholds": thresholds, "conformal": conformal,
                 "background": background, "card": card.model_dump()}, out / "bundle.joblib")
    (REPORTS / f"model_card_{mode}.json").write_text(card.model_dump_json(indent=1))
    (REPORTS / f"conformal_{mode}.json").write_text(json.dumps(conf_eval, indent=1))
    log.info("%s: macro AUROC %.4f, conformal coverage %s, joint %.3f", mode, ml["macro_auroc"], cov, conf_eval["coverage_joint"])


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    set_global_seed()
    params = {k: v for k, v in json.loads((REPORTS / "best_params.json").read_text()).items() if k != "cv_macro_auroc"}
    metrics = json.loads((REPORTS / "metrics.json").read_text())
    train, test = split(build_dataset())
    for mode in ("strict", "full"):
        package_mode(mode, train, test, params, metrics)


if __name__ == "__main__":
    main()
