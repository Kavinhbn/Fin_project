"""Feature sets with explicit label-leakage control.

Diabetes and hypertension labels are defined from glucose/HbA1c and blood pressure, so
those measurements must not be inputs for the label they define. Two modes are supported:
`strict` (leakage removed, the honest result) and `full` (everything, for comparison).
"""
from __future__ import annotations

import pandas as pd

BASE_FEATURES: list[str] = [
    "RIDAGEYR", "SEX_MALE", "BMXBMI",
    "LBXTC", "LBDHDD", "LBDLDL", "LBXTR",
    "SMOKER", "RIDRETH1", "EDUCATION", "INCOME_RATIO", "VIGOROUS_ACTIVITY", "ALCOHOL_12PLUS",
]
GLUCOSE_FEATURES: list[str] = ["LBXGH", "LBXGLU"]
BP_FEATURES: list[str] = ["SBP_MEAN", "DBP_MEAN"]

# Features that define each label and must be excluded in strict mode.
LEAKY: dict[str, list[str]] = {
    "diabetes": GLUCOSE_FEATURES,
    "hypertension": BP_FEATURES,
    "cvd": [],
}


def select_features(target: str, mode: str = "strict") -> list[str]:
    """Return the feature columns allowed for `target`.

    Raises ValueError for an unknown target or mode.
    """
    if target not in LEAKY:
        raise ValueError(f"unknown target: {target!r}")
    if mode not in ("strict", "full"):
        raise ValueError(f"mode must be 'strict' or 'full', got {mode!r}")
    every = BASE_FEATURES + GLUCOSE_FEATURES + BP_FEATURES
    banned = set(LEAKY[target]) if mode == "strict" else set()
    return [c for c in every if c not in banned]


def assert_no_leakage(columns: list[str], target: str) -> None:
    """Raise if any label-defining column is present (guard for strict pipelines)."""
    bad = sorted(set(columns) & set(LEAKY[target]))
    if bad:
        raise ValueError(f"leakage: {bad} define '{target}' and cannot be features")


def frame_for(df: pd.DataFrame, target: str, mode: str = "strict") -> pd.DataFrame:
    """Subset df to the allowed feature columns that exist in df."""
    cols = [c for c in select_features(target, mode) if c in df.columns]
    return df[cols]
