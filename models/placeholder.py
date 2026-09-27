"""PLACEHOLDER risk model: a fixed heuristic, NOT trained and NOT clinically valid.

It exists so the API and UI can be built and tested before the real XGBoost cascade is
trained. Every response that uses it is flagged via `is_placeholder`.
"""
from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

from common.schemas import (
    CvdPathways,
    Disease,
    DiseaseExplanation,
    DiseaseRisk,
    Driver,
    FeatureMode,
    Level,
    ModelOutput,
    PatientInput,
)


@dataclass(frozen=True)
class _Term:
    feature: str
    weight: float
    read: Callable[[PatientInput], float | None]
    fmt: Callable[[float], str]
    ref: float


def _num(v: float) -> str:
    return f"{v:g}"


TERMS: dict[Disease, list[_Term]] = {
    "diabetes": [
        _Term("BMI", 0.09, lambda p: p.bmi, lambda v: f"{_num(v)} kg/m²", 26),
        _Term("Age", 0.03, lambda p: p.age, lambda v: f"{_num(v)} y", 45),
        _Term("HbA1c", 1.4, lambda p: p.hba1c, lambda v: f"{_num(v)}%", 5.4),
        _Term("Fasting glucose", 0.03, lambda p: p.fasting_glucose, lambda v: f"{_num(v)} mg/dL", 95),
        _Term("Triglycerides", 0.004, lambda p: p.triglycerides, lambda v: f"{_num(v)} mg/dL", 130),
        _Term("HDL cholesterol", -0.03, lambda p: p.hdl, lambda v: f"{_num(v)} mg/dL", 50),
    ],
    "hypertension": [
        _Term("Age", 0.045, lambda p: p.age, lambda v: f"{_num(v)} y", 45),
        _Term("BMI", 0.08, lambda p: p.bmi, lambda v: f"{_num(v)} kg/m²", 26),
        _Term("Systolic BP", 0.05, lambda p: p.sbp, lambda v: f"{_num(v)} mmHg", 120),
        _Term("Diastolic BP", 0.05, lambda p: p.dbp, lambda v: f"{_num(v)} mmHg", 80),
        _Term("LDL cholesterol", 0.006, lambda p: p.ldl, lambda v: f"{_num(v)} mg/dL", 110),
    ],
    "cvd": [
        _Term("Age", 0.06, lambda p: p.age, lambda v: f"{_num(v)} y", 45),
        _Term("Smoking", 0.9, lambda p: None if p.smoker is None else float(p.smoker),
              lambda v: "Current/former" if v else "Never", 0),
        _Term("Total cholesterol", 0.006, lambda p: p.total_cholesterol, lambda v: f"{_num(v)} mg/dL", 190),
        _Term("HDL cholesterol", -0.03, lambda p: p.hdl, lambda v: f"{_num(v)} mg/dL", 50),
        _Term("BMI", 0.05, lambda p: p.bmi, lambda v: f"{_num(v)} kg/m²", 26),
    ],
}
INTERCEPT: dict[Disease, float] = {"diabetes": -1.6, "hypertension": -1.2, "cvd": -3.0}
STRICT_HIDDEN: dict[Disease, set[str]] = {
    "diabetes": {"HbA1c", "Fasting glucose"},
    "hypertension": {"Systolic BP", "Diastolic BP"},
    "cvd": set(),
}
DM_WEIGHT, HTN_WEIGHT = 1.1, 0.9
DIRECT_FLOOR = 0.05


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def level_for(p: float) -> Level:
    """Placeholder level rule. Real thresholds are a clinical decision made with clinicians."""
    if abs(p - 0.5) < 0.06:
        return "uncertain"
    if p < 0.2:
        return "low"
    if p < 0.5:
        return "moderate"
    return "high"


class PlaceholderModel:
    version = "placeholder-heuristic-0"
    is_placeholder = True

    def _score(self, disease: Disease, x: PatientInput, mode: FeatureMode,
               dm_p: float = 0.0, htn_p: float = 0.0) -> tuple[DiseaseRisk, DiseaseExplanation]:
        hidden = STRICT_HIDDEN[disease] if mode == "strict" else set()
        logit = INTERCEPT[disease] + (0.25 if x.sex == "male" else 0.0)
        drivers: list[Driver] = []
        for term in TERMS[disease]:
            if term.feature in hidden:
                continue
            raw = term.read(x)
            if raw is None:
                continue
            contribution = term.weight * (raw - term.ref)
            logit += contribution
            drivers.append(Driver(feature=term.feature, value=term.fmt(raw), contribution=round(contribution, 3)))
        if disease == "cvd":
            for name, share, weight in (("Diabetes (predicted)", dm_p, DM_WEIGHT), ("Hypertension (predicted)", htn_p, HTN_WEIGHT)):
                contribution = weight * share
                logit += contribution
                drivers.append(Driver(feature=name, value=f"{round(share * 100)}%", contribution=round(contribution, 3)))
        p = round(_sigmoid(logit), 3)
        half = 0.06
        risk = DiseaseRisk(probability=p, ci=(round(max(0.0, p - half), 3), round(min(1.0, p + half), 3)), level=level_for(p))
        ordered = sorted(drivers, key=lambda d: d.contribution, reverse=True)
        explanation = DiseaseExplanation(
            positive=[d for d in ordered if d.contribution > 0][:3],
            negative=[d for d in reversed(ordered) if d.contribution < 0][:3],
        )
        return risk, explanation

    def predict(self, patient: PatientInput, mode: FeatureMode) -> ModelOutput:
        dm, dm_x = self._score("diabetes", patient, mode)
        htn, htn_x = self._score("hypertension", patient, mode)
        cvd, cvd_x = self._score("cvd", patient, mode, dm.probability, htn.probability)
        dm_share = DM_WEIGHT * dm.probability
        htn_share = HTN_WEIGHT * htn.probability
        direct = max(DIRECT_FLOOR, sum(d.contribution for d in cvd_x.positive if "(predicted)" not in d.feature))
        total = dm_share + htn_share + direct
        return ModelOutput(
            risks={"diabetes": dm, "hypertension": htn, "cvd": cvd},
            explanation={"diabetes": dm_x, "hypertension": htn_x, "cvd": cvd_x},
            cvd_pathways=CvdPathways(
                direct=round(direct / total, 3),
                via_diabetes=round(dm_share / total, 3),
                via_hypertension=round(htn_share / total, 3),
            ),
        )
