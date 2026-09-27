"""Multi-label evaluation: discrimination, calibration, thresholded metrics and bootstrap CIs."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    hamming_loss,
    roc_auc_score,
)

from common.config import SEED, TARGETS


def expected_calibration_error(y: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    """Equal-width ECE: weighted mean |observed rate - mean predicted| over probability bins."""
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges[1:-1]), 0, bins - 1)
    total = 0.0
    for b in range(bins):
        m = idx == b
        if m.any():
            total += m.mean() * abs(y[m].mean() - p[m].mean())
    return float(total)


def best_f1_threshold(y: np.ndarray, p: np.ndarray) -> float:
    """Threshold maximising F1 (choose on out-of-fold predictions, never on the test set)."""
    grid = np.linspace(0.05, 0.95, 91)
    scores = [f1_score(y, p >= t, zero_division=0) for t in grid]
    return float(grid[int(np.argmax(scores))])


def choose_thresholds(y: pd.DataFrame, oof: pd.DataFrame) -> dict[str, float]:
    return {t: best_f1_threshold(y[t].to_numpy(), oof[t].to_numpy()) for t in TARGETS}


def label_metrics(y: np.ndarray, p: np.ndarray, threshold: float) -> dict[str, float]:
    pred = p >= threshold
    return {
        "auroc": float(roc_auc_score(y, p)),
        "auprc": float(average_precision_score(y, p)),
        "brier": float(brier_score_loss(y, p)),
        "ece": expected_calibration_error(y, p),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "threshold": float(threshold),
    }


def multilabel_metrics(Y: pd.DataFrame, P: pd.DataFrame, thresholds: dict[str, float]) -> dict[str, float]:
    """Subset accuracy, Hamming loss, macro/micro F1 at the given thresholds."""
    yt = Y[list(TARGETS)].to_numpy()
    yp = np.column_stack([P[t].to_numpy() >= thresholds[t] for t in TARGETS])
    return {
        "subset_accuracy": float((yt == yp).all(axis=1).mean()),
        "hamming_loss": float(hamming_loss(yt, yp)),
        "macro_f1": float(f1_score(yt, yp, average="macro", zero_division=0)),
        "micro_f1": float(f1_score(yt, yp, average="micro", zero_division=0)),
        "macro_auroc": float(np.mean([roc_auc_score(Y[t], P[t]) for t in TARGETS])),
    }


def bootstrap_ci(Y: pd.DataFrame, P: pd.DataFrame, thresholds: dict[str, float], n: int = 500,
                 seed: int = SEED) -> dict[str, dict[str, list[float]]]:
    """Percentile 95% CIs for per-label AUROC/ECE/F1 and macro AUROC/F1 (row resampling)."""
    rng = np.random.default_rng(seed)
    rows = len(Y)
    y_arr, p_arr = Y[list(TARGETS)].to_numpy(), P[list(TARGETS)].to_numpy()
    draws: dict[str, list[float]] = {}
    for _ in range(n):
        idx = rng.integers(0, rows, rows)
        aucs, f1s = [], []
        for j, t in enumerate(TARGETS):
            yy, pp = y_arr[idx, j], p_arr[idx, j]
            if yy.min() == yy.max():
                continue
            auc = roc_auc_score(yy, pp)
            f1 = f1_score(yy, pp >= thresholds[t], zero_division=0)
            aucs.append(auc)
            f1s.append(f1)
            draws.setdefault(f"{t}_auroc", []).append(float(auc))
            draws.setdefault(f"{t}_ece", []).append(expected_calibration_error(yy, pp))
        if len(aucs) == len(TARGETS):
            draws.setdefault("macro_auroc", []).append(float(np.mean(aucs)))
            draws.setdefault("macro_f1", []).append(float(np.mean(f1s)))
    return {k: {"ci": [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))]} for k, v in draws.items()}


def full_report(Y: pd.DataFrame, P: pd.DataFrame, thresholds: dict[str, float], n_boot: int = 500) -> dict[str, object]:
    return {
        "per_label": {t: label_metrics(Y[t].to_numpy(), P[t].to_numpy(), thresholds[t]) for t in TARGETS},
        "multilabel": multilabel_metrics(Y, P, thresholds),
        "bootstrap": bootstrap_ci(Y, P, thresholds, n_boot),
        "n": len(Y),
    }
