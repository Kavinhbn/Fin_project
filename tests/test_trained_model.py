import time
from pathlib import Path

import pytest

from common.schemas import PatientInput
from models.trained import TrainedRiskModel

pytestmark = pytest.mark.skipif(
    not (Path("models/artifacts/strict/bundle.joblib").exists() and Path("models/artifacts/full/bundle.joblib").exists()),
    reason="run `python -m models.train` and `python -m models.package` first",
)

HIGH = PatientInput(age=68, sex="male", bmi=33, sbp=158, dbp=94, fasting_glucose=140, hba1c=7.1,
                    total_cholesterol=235, hdl=36, ldl=155, triglycerides=240, smoker=True)
LOW = PatientInput(age=27, sex="female", bmi=22, sbp=110, dbp=70, hba1c=5.0, hdl=65, smoker=False)


@pytest.fixture(scope="module")
def model():
    m = TrainedRiskModel.load()
    assert m is not None
    return m


def test_higher_risk_patient_scores_higher(model):
    hi, lo = model.predict(HIGH, "full"), model.predict(LOW, "full")
    for d in ("diabetes", "hypertension", "cvd"):
        assert hi.risks[d].probability > lo.risks[d].probability


def test_strict_mode_hides_label_defining_drivers(model):
    out = model.predict(HIGH, "strict")
    names = {d.feature for d in out.explanation["diabetes"].positive + out.explanation["diabetes"].negative}
    assert not names & {"HbA1c", "Fasting glucose"}
    names = {d.feature for d in out.explanation["hypertension"].positive + out.explanation["hypertension"].negative}
    assert not names & {"Systolic BP", "Diastolic BP"}


def test_output_is_well_formed_and_fast(model):
    t0 = time.time()
    out = model.predict(HIGH, "strict")
    assert time.time() - t0 < 15
    p = out.cvd_pathways
    assert abs(p.direct + p.via_diabetes + p.via_hypertension - 1) < 0.01
    assert all(0 <= r.probability <= 1 for r in out.risks.values())
    assert all(len(e.positive) <= 3 and len(e.negative) <= 3 for e in out.explanation.values())


def test_missing_optional_inputs_work(model):
    out = model.predict(PatientInput(age=50, sex="female", bmi=27), "strict")
    assert out.risks["cvd"].level in {"low", "moderate", "high", "uncertain"}


def test_model_card_is_real(model):
    card = model.card("strict")
    assert card.mode == "strict" and card.model_version.startswith("xgb-cascade")
    assert {m.label for m in card.metrics} >= {"Macro AUROC", "Conformal coverage"}
    assert any("Cascade" in b.model.title() for b in card.baselines)
