import numpy as np
import pandas as pd

from data_preprocessing.labels import build_labels, define_cvd, define_diabetes, mean_blood_pressure


def _base(**over):
    row = {
        "DIQ010": 2, "DIQ050": 2, "DIQ070": 2, "LBXGH": 5.2, "LBXGLU": 90.0,
        "BPQ020": 2, "BPQ040A": 2,
        "BPXSY1": 118.0, "BPXSY2": 120.0, "BPXDI1": 76.0, "BPXDI2": 78.0,
        "MCQ160B": 2, "MCQ160C": 2, "MCQ160D": 2, "MCQ160E": 2, "MCQ160F": 2,
    }
    row.update(over)
    return pd.DataFrame([row])


def test_healthy_all_zero():
    out = build_labels(_base())
    assert out.loc[0, ["diabetes", "hypertension", "cvd"]].tolist() == [0, 0, 0]


def test_diabetes_by_hba1c_even_if_self_report_no():
    assert define_diabetes(_base(LBXGH=6.8)).iloc[0] == 1


def test_diabetes_undetermined_when_no_self_report_and_no_lab():
    df = _base(DIQ010=np.nan, LBXGH=np.nan, LBXGLU=np.nan)
    assert np.isnan(define_diabetes(df).iloc[0])


def test_hypertension_from_measured_bp_and_cutoffs():
    df = _base(BPXSY1=150.0, BPXSY2=146.0)
    assert build_labels(df).loc[0, "hypertension"] == 1
    assert build_labels(_base(BPXSY1=134.0, BPXSY2=134.0), 130, 80).loc[0, "hypertension"] == 1
    assert build_labels(_base(BPXSY1=134.0, BPXSY2=134.0)).loc[0, "hypertension"] == 0


def test_zero_diastolic_ignored():
    df = mean_blood_pressure(_base(BPXDI1=0.0, BPXDI2=80.0))
    assert df.loc[0, "DBP_MEAN"] == 80.0


def test_cvd_any_condition():
    assert define_cvd(_base(MCQ160E=1)).iloc[0] == 1
    assert define_cvd(_base()).iloc[0] == 0
