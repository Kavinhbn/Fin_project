"""The trained NHANES cascade wrapped as a `RiskModel` for the API."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from common.config import EDUCATION_OPTIONS, RACE_ETHNICITY_OPTIONS
from common.schemas import (
    CvdPathways,
    Disease,
    DiseaseExplanation,
    DiseaseRisk,
    Driver,
    FeatureMode,
    Level,
    ModelCard,
    ModelOutput,
    PatientInput,
)
from explainability.mediation import FEATURE_LABEL, cascade_attribution, head_attributions
from models.cascade import CascadeModel

MODES: tuple[FeatureMode, ...] = ("strict", "full")
NOTICE = ("Research prototype trained on NHANES 2005-2018 (US adults, self-reported CVD). "
          "Not validated for clinical use.")

# API field -> model feature column (numeric fields; booleans and sex handled separately below)
API_TO_FEATURE: dict[str, str] = {
    "age": "RIDAGEYR", "bmi": "BMXBMI", "sbp": "SBP_MEAN", "dbp": "DBP_MEAN", "fasting_glucose": "LBXGLU",
    "hba1c": "LBXGH", "total_cholesterol": "LBXTC", "hdl": "LBDHDD", "ldl": "LBDLDL", "triglycerides": "LBXTR",
    "race_ethnicity": "RIDRETH1", "education": "EDUCATION", "income_ratio": "INCOME_RATIO",
}
UNITS: dict[str, str] = {
    "RIDAGEYR": " y", "BMXBMI": " kg/m²", "SBP_MEAN": " mmHg", "DBP_MEAN": " mmHg", "LBXGLU": " mg/dL",
    "LBXGH": "%", "LBXTC": " mg/dL", "LBDHDD": " mg/dL", "LBDLDL": " mg/dL", "LBXTR": " mg/dL",
}


def patient_row(patient: PatientInput, columns: list[str]) -> pd.DataFrame:
    """One-row feature frame; anything not provided stays NaN (the model handles missing values)."""
    row = dict.fromkeys(columns, np.nan)
    for field, col in API_TO_FEATURE.items():
        value = getattr(patient, field)
        if value is not None and col in row:
            row[col] = float(value)
    if "SEX_MALE" in row:
        row["SEX_MALE"] = 1.0 if patient.sex == "male" else 0.0
    if "SMOKER" in row and patient.smoker is not None:
        row["SMOKER"] = 1.0 if patient.smoker else 0.0
    if "VIGOROUS_ACTIVITY" in row and patient.vigorous_activity is not None:
        row["VIGOROUS_ACTIVITY"] = 1.0 if patient.vigorous_activity else 0.0
    if "ALCOHOL_12PLUS" in row and patient.alcohol_12plus is not None:
        row["ALCOHOL_12PLUS"] = 1.0 if patient.alcohol_12plus else 0.0
    return pd.DataFrame([row])


def _format_value(feature: str, row: pd.DataFrame) -> str:
    v = row[feature].iloc[0] if feature in row else np.nan
    if np.isnan(v):
        return "not provided"
    if feature == "SEX_MALE":
        return "Male" if v else "Female"
    if feature == "SMOKER":
        return "Current or former smoker" if v else "Never smoked"
    if feature == "VIGOROUS_ACTIVITY":
        return "Yes" if v else "No"
    if feature == "ALCOHOL_12PLUS":
        return "Yes" if v else "No"
    if feature == "RIDRETH1":
        return RACE_ETHNICITY_OPTIONS.get(int(v), f"code {v:g}")
    if feature == "EDUCATION":
        return EDUCATION_OPTIONS.get(int(v), f"code {v:g}")
    return f"{v:g}{UNITS.get(feature, '')}"


class TrainedRiskModel:
    """Loads bundles written by models.package and serves risks, explanations and a model card."""

    is_placeholder = False
    notice = NOTICE

    def __init__(self, bundles: dict[FeatureMode, dict[str, Any]]) -> None:
        if not bundles:
            raise ValueError("no model bundles supplied")
        self.bundles = bundles
        self.version: str = next(iter(bundles.values()))["version"]

    @classmethod
    def load(cls, root: Path = Path("models/artifacts")) -> TrainedRiskModel | None:
        """Return the model if bundles exist for every mode, else None."""
        found = {m: joblib.load(root / m / "bundle.joblib") for m in MODES if (root / m / "bundle.joblib").exists()}
        if len(found) != len(MODES):
            return None
        model = cls(found)
        model.warmup()
        return model

    def warmup(self) -> None:
        """The first SHAP call pays a one-off ~15 s start-up cost; pay it at load, not on a user request."""
        self.predict(PatientInput(age=50, sex="female", bmi=27), "strict")

    def _level(self, bundle: dict[str, Any], disease: Disease, p: float) -> Level:
        thr = bundle["thresholds"][disease]  # F1-optimal cut; provisional risk bands derived from it
        return "high" if p >= thr else "moderate" if p >= thr / 2 else "low"

    def predict(self, patient: PatientInput, mode: FeatureMode) -> ModelOutput:
        bundle = self.bundles[mode]
        model: CascadeModel = bundle["model"]
        columns = [c for c in bundle["background"].columns]
        x = patient_row(patient, columns)
        probs = model.predict_proba(x).iloc[0]
        uncertain = {t: bool(v[0]) for t, v in bundle["conformal"].is_uncertain(model.predict_proba(x)).items()}
        heads = head_attributions(model, x, bundle["background"], n_background=50, permutations=8)
        attribution = cascade_attribution(model, x, bundle["background"], n_background=50, permutations=8)
        shares = attribution.shares()

        risks: dict[Disease, DiseaseRisk] = {}
        explanation: dict[Disease, DiseaseExplanation] = {}
        for d in ("diabetes", "hypertension", "cvd"):
            p = float(probs[d])
            risks[d] = DiseaseRisk(probability=round(p, 3), ci=None, level=self._level(bundle, d, p), uncertain=uncertain[d])
            # Only inputs the clinician actually provided are listed: a missing value's effect is a
            # model artefact, not a finding about the patient. Units: probability percentage points.
            given = sorted(((c, v * 100) for c, v in heads[d].items() if not np.isnan(x[c].iloc[0]) and abs(v * 100) >= 0.05),
                           key=lambda cv: cv[1], reverse=True)

            def to_driver(item: tuple[str, float]) -> Driver:
                col, val = item
                return Driver(feature=FEATURE_LABEL.get(col, col), value=_format_value(col, x), contribution=round(val, 1))

            explanation[d] = DiseaseExplanation(
                positive=[to_driver(i) for i in given if i[1] > 0][:3],
                negative=[to_driver(i) for i in reversed(given) if i[1] < 0][:3])
        return ModelOutput(risks=risks, explanation=explanation, cvd_pathways=CvdPathways(
            direct=round(shares["direct"], 3), via_diabetes=round(shares["via_diabetes"], 3),
            via_hypertension=round(shares["via_hypertension"], 3)))

    def card(self, mode: FeatureMode) -> ModelCard:
        return ModelCard.model_validate(self.bundles[mode]["card"])
