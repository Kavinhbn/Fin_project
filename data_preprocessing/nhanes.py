"""Load and merge NHANES 2005-2018 SAS transport (.xpt) files into one adult table.

Files are downloaded from CDC (public, de-identified) into `data/raw` by
`scripts/download_nhanes.py`. Column names were checked against the downloaded files.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from data_preprocessing.labels import build_labels

log = logging.getLogger(__name__)

# Cycle letter -> years. Cycle J (2017-2018) is held out as the temporal test set.
CYCLES: dict[str, str] = {
    "D": "2005-2006", "E": "2007-2008", "F": "2009-2010", "G": "2011-2012",
    "H": "2013-2014", "I": "2015-2016", "J": "2017-2018",
}
TEST_CYCLE = "J"

# component file -> columns kept
COMPONENTS: dict[str, list[str]] = {
    "DEMO": ["SEQN", "RIAGENDR", "RIDAGEYR", "RIDRETH1", "DMDEDUC2", "INDFMPIR"],
    "BMX": ["SEQN", "BMXBMI"],
    "BPX": ["SEQN", "BPXSY1", "BPXSY2", "BPXSY3", "BPXSY4", "BPXDI1", "BPXDI2", "BPXDI3", "BPXDI4"],
    "GHB": ["SEQN", "LBXGH"],
    "GLU": ["SEQN", "LBXGLU"],
    "TCHOL": ["SEQN", "LBXTC"],
    "HDL": ["SEQN", "LBDHDD"],
    "TRIGLY": ["SEQN", "LBXTR", "LBDLDL"],
    "DIQ": ["SEQN", "DIQ010", "DIQ050", "DIQ070"],
    "BPQ": ["SEQN", "BPQ020", "BPQ040A"],
    "MCQ": ["SEQN", "MCQ160B", "MCQ160C", "MCQ160D", "MCQ160E", "MCQ160F"],
    "SMQ": ["SEQN", "SMQ020"],
    # PAQ605 (vigorous work activity) is absent in cycle D (2005-06, older questionnaire format);
    # ALQ101 (>=12 drinks/year) is absent in cycle J (2017-18, renamed ALQ111). Both cases become
    # NaN for that cycle via the `for missing in ...` fallback below, which the model handles.
    "PAQ": ["SEQN", "PAQ605"],
    "ALQ": ["SEQN", "ALQ101"],
}
MIN_AGE = 20  # the MCQ heart-disease questions are asked of adults 20+


class MissingDataError(FileNotFoundError):
    """A required NHANES file is not present in the raw data directory."""


def load_cycle(letter: str, raw_dir: Path) -> pd.DataFrame:
    """Merge all components of one cycle on SEQN (left join from DEMO)."""
    if letter not in CYCLES:
        raise ValueError(f"unknown cycle {letter!r}; expected one of {sorted(CYCLES)}")
    merged: pd.DataFrame | None = None
    for comp, cols in COMPONENTS.items():
        path = raw_dir / f"{comp}_{letter}.xpt"
        if not path.exists():
            raise MissingDataError(f"{path} not found; run scripts/download_nhanes.py")
        df = pd.read_sas(path, format="xport")
        for missing in [c for c in cols if c not in df.columns]:
            log.warning("cycle %s: column %s missing in %s, filled with NaN", letter, missing, comp)
            df[missing] = np.nan
        df = df[cols].drop_duplicates("SEQN")
        merged = df if merged is None else merged.merge(df, on="SEQN", how="left")
    if merged is None:
        raise ValueError("no components configured")
    merged["CYCLE"] = letter
    return merged


def load_all(raw_dir: Path = Path("data/raw"), cycles: list[str] | None = None) -> pd.DataFrame:
    """Load and concatenate the requested cycles (default all)."""
    frames = [load_cycle(c, raw_dir) for c in (cycles or list(CYCLES))]
    return pd.concat(frames, ignore_index=True)


def recode(df: pd.DataFrame) -> pd.DataFrame:
    """Recode survey answers to model-ready numeric features aligned with the API inputs."""
    out = df.copy()
    out["SEX_MALE"] = out["RIAGENDR"].map({1: 1.0, 2: 0.0})
    out["SMOKER"] = out["SMQ020"].map({1: 1.0, 2: 0.0})  # >=100 cigarettes in lifetime
    out["VIGOROUS_ACTIVITY"] = out["PAQ605"].map({1: 1.0, 2: 0.0})  # does vigorous work activity
    out["ALCOHOL_12PLUS"] = out["ALQ101"].map({1: 1.0, 2: 0.0})  # had >=12 alcoholic drinks/year
    # DMDEDUC2: 1=<9th grade .. 5=college graduate+; 7/9=refused/don't know -> NaN
    out["EDUCATION"] = out["DMDEDUC2"].where(out["DMDEDUC2"].between(1, 5))
    out["INCOME_RATIO"] = out["INDFMPIR"]  # ratio of family income to the poverty line, capped at 5
    return out


def build_dataset(raw_dir: Path = Path("data/raw"), sbp_cut: float = 140, dbp_cut: float = 90) -> pd.DataFrame:
    """Adults with all three labels determined, plus recoded features."""
    raw = load_all(raw_dir)
    raw = raw[raw["RIDAGEYR"] >= MIN_AGE]
    labelled = build_labels(raw.reset_index(drop=True), sbp_cut, dbp_cut)
    return recode(labelled)


def quality_report(df: pd.DataFrame) -> dict[str, object]:
    """Row counts, label prevalence and missingness for the data-quality report."""
    labels = ["diabetes", "hypertension", "cvd"]
    feats = ["RIDAGEYR", "SEX_MALE", "BMXBMI", "SBP_MEAN", "DBP_MEAN", "LBXGLU", "LBXGH", "LBXTC",
             "LBDHDD", "LBDLDL", "LBXTR", "SMOKER", "RIDRETH1", "EDUCATION", "INCOME_RATIO",
             "VIGOROUS_ACTIVITY", "ALCOHOL_12PLUS"]
    return {
        "rows": len(df),
        "per_cycle": df["CYCLE"].value_counts().sort_index().to_dict(),
        "prevalence": {k: round(float(df[k].mean()), 4) for k in labels},
        "comorbidity_counts": {
            "none": int((df[labels].sum(axis=1) == 0).sum()),
            "one": int((df[labels].sum(axis=1) == 1).sum()),
            "two": int((df[labels].sum(axis=1) == 2).sum()),
            "three": int((df[labels].sum(axis=1) == 3).sum()),
        },
        "missing_fraction": {c: round(float(df[c].isna().mean()), 3) for c in feats},
    }
