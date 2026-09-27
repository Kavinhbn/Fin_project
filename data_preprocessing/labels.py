"""Build Diabetes / Hypertension / CVD labels from NHANES columns.

Column names follow the CDC NHANES codebooks as recalled by the author and MUST be
verified against the codebook of each cycle before final results (notably BP columns,
which changed to oscillometric BPXO* names in 2017-2018).

Survey codes: 1 = yes, 2 = no, 3 = borderline, 7 = refused, 9 = don't know.
Each label is 1 if any criterion is positive, 0 if the self-report is 'no' and no
measured criterion is positive, and NaN when it cannot be determined.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

YES, NO = 1, 2


def _yes(series: pd.Series) -> pd.Series:
    """Boolean mask of answers equal to 'yes' (missing/7/9 become False)."""
    return series.eq(YES)


def _combine(any_positive: pd.Series, self_report_no: pd.Series) -> pd.Series:
    """1 if any positive, 0 if self-report is 'no' and nothing positive, else NaN."""
    out = pd.Series(np.nan, index=any_positive.index, dtype="float64")
    out[self_report_no] = 0.0
    out[any_positive] = 1.0
    return out


def define_diabetes(df: pd.DataFrame) -> pd.Series:
    """Diabetes = told by doctor (DIQ010), HbA1c >= 6.5 (LBXGH), fasting glucose >= 126
    (LBXGLU), or on insulin (DIQ050) / diabetes pills (DIQ070)."""
    positive = (
        _yes(df["DIQ010"])
        | df["LBXGH"].ge(6.5)
        | df["LBXGLU"].ge(126)
        | _yes(df["DIQ050"])
        | _yes(df["DIQ070"])
    )
    return _combine(positive, df["DIQ010"].isin([NO, 3]))


def define_hypertension(
    df: pd.DataFrame, sbp_cut: float = 140, dbp_cut: float = 90
) -> pd.Series:
    """Hypertension = told by doctor (BPQ020), on BP medication (BPQ040A), or mean
    measured SBP >= sbp_cut / DBP >= dbp_cut. Needs columns SBP_MEAN and DBP_MEAN
    (see `mean_blood_pressure`). Default 140/90; use 130/80 as sensitivity analysis."""
    positive = (
        _yes(df["BPQ020"])
        | _yes(df["BPQ040A"])
        | df["SBP_MEAN"].ge(sbp_cut)
        | df["DBP_MEAN"].ge(dbp_cut)
    )
    return _combine(positive, df["BPQ020"].eq(NO))


def define_cvd(df: pd.DataFrame) -> pd.Series:
    """CVD = self-reported heart failure (MCQ160B), coronary heart disease (MCQ160C),
    angina (MCQ160D), heart attack (MCQ160E) or stroke (MCQ160F). Self-reported."""
    cols = ["MCQ160B", "MCQ160C", "MCQ160D", "MCQ160E", "MCQ160F"]
    positive = pd.concat([_yes(df[c]) for c in cols], axis=1).any(axis=1)
    all_no = pd.concat([df[c].eq(NO) for c in cols], axis=1).all(axis=1)
    return _combine(positive, all_no)


def mean_blood_pressure(df: pd.DataFrame) -> pd.DataFrame:
    """Add SBP_MEAN / DBP_MEAN as the mean of available readings.

    Uses BPXSY1-4 / BPXDI1-4 (auscultatory, up to 2016) and BPXOSY1-3 / BPXODI1-3
    (oscillometric, 2017-2018) when present. Zero diastolic readings are treated as missing.
    """
    out = df.copy()
    sys_cols = [c for c in out.columns if c.startswith(("BPXSY", "BPXOSY"))]
    dia_cols = [c for c in out.columns if c.startswith(("BPXDI", "BPXODI"))]
    out["SBP_MEAN"] = out[sys_cols].mean(axis=1, skipna=True) if sys_cols else np.nan
    dia = out[dia_cols].where(out[dia_cols] > 0) if dia_cols else None
    out["DBP_MEAN"] = dia.mean(axis=1, skipna=True) if dia is not None else np.nan
    return out


def build_labels(df: pd.DataFrame, sbp_cut: float = 140, dbp_cut: float = 90) -> pd.DataFrame:
    """Return df with `diabetes`, `hypertension`, `cvd` columns; rows with any undetermined
    label are dropped."""
    out = mean_blood_pressure(df)
    out["diabetes"] = define_diabetes(out)
    out["hypertension"] = define_hypertension(out, sbp_cut, dbp_cut)
    out["cvd"] = define_cvd(out)
    return out.dropna(subset=["diabetes", "hypertension", "cvd"]).reset_index(drop=True)
