"""Domain schemas shared by the API, models and LLM layers (mirrors frontend/src/api/types.ts)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from common.config import CLINICAL_RANGES as R
from common.config import EDUCATION_OPTIONS, RACE_ETHNICITY_OPTIONS

Disease = Literal["diabetes", "hypertension", "cvd"]
Level = Literal["low", "moderate", "high", "uncertain", "not_assessed"]
Role = Literal["clinician", "viewer", "admin"]
FeatureMode = Literal["strict", "full"]


def _f(name: str, required: bool = False):
    lo, hi = R[name]
    return Field(... if required else None, ge=lo, le=hi)


def _cat(options: dict[int, str]):
    return Field(None, ge=min(options), le=max(options))


class PatientInput(BaseModel):
    """Routine checkup inputs. Optional labs may be omitted (model handles missing values)."""

    age: float = _f("age", True)
    sex: Literal["male", "female"]
    bmi: float = _f("bmi", True)
    sbp: float | None = _f("sbp")
    dbp: float | None = _f("dbp")
    fasting_glucose: float | None = _f("fasting_glucose")
    hba1c: float | None = _f("hba1c")
    total_cholesterol: float | None = _f("total_cholesterol")
    hdl: float | None = _f("hdl")
    ldl: float | None = _f("ldl")
    triglycerides: float | None = _f("triglycerides")
    smoker: bool | None = None
    # Socioeconomic and lifestyle fields: optional, improve accuracy when available (see
    # data_preprocessing/nhanes.py recode()), never required so the form still works without them.
    race_ethnicity: int | None = _cat(RACE_ETHNICITY_OPTIONS)
    education: int | None = _cat(EDUCATION_OPTIONS)
    income_ratio: float | None = _f("income_ratio")
    vigorous_activity: bool | None = None
    alcohol_12plus: bool | None = None

    @field_validator("dbp")
    @classmethod
    def _dbp_below_sbp(cls, value: float | None, info) -> float | None:
        sbp = info.data.get("sbp")
        if value is not None and sbp is not None and sbp <= value:
            raise ValueError("sbp must be greater than dbp")
        return value


class DiseaseRisk(BaseModel):
    probability: float = Field(ge=0, le=1)
    ci: tuple[float, float] | None = None
    level: Level
    uncertain: bool = False  # conformal set contains both classes: the model abstains


class Driver(BaseModel):
    feature: str
    value: str
    contribution: float


class DiseaseExplanation(BaseModel):
    positive: list[Driver]
    negative: list[Driver]


class CvdPathways(BaseModel):
    direct: float
    via_diabetes: float
    via_hypertension: float


class ModelOutput(BaseModel):
    risks: dict[Disease, DiseaseRisk]
    explanation: dict[Disease, DiseaseExplanation]
    cvd_pathways: CvdPathways


class NoteSection(BaseModel):
    title: str
    body: str


class FlaggedClaim(BaseModel):
    claim: str
    reason: str


class VerifierResult(BaseModel):
    checked: int
    passed: int
    flagged: list[FlaggedClaim]


class Note(BaseModel):
    sections: list[NoteSection]
    generated_at: datetime
    verifier: VerifierResult
    reviewed_by: str | None = None


class Assessment(BaseModel):
    id: str
    version: int
    created_at: datetime
    created_by: str
    mode: FeatureMode
    input: PatientInput
    risks: dict[Disease, DiseaseRisk]
    explanation: dict[Disease, DiseaseExplanation]
    cvd_pathways: CvdPathways
    model_version: str
    disclaimer: str
    note: Note | None = None


class Me(BaseModel):
    email: str
    name: str
    role: Role


class AuditEntry(BaseModel):
    id: str
    timestamp: datetime
    user: str
    model_version: str
    input_hash: str
    verifier: Literal["passed", "flagged", "not_run"]


class CreateAssessmentRequest(BaseModel):
    input: PatientInput
    mode: FeatureMode = "strict"


class ReviewRequest(BaseModel):
    version: int


class RiskResponse(BaseModel):
    """Joint risk vector plus mandatory disclaimer."""

    diabetes: float = Field(ge=0, le=1)
    hypertension: float = Field(ge=0, le=1)
    cvd: float = Field(ge=0, le=1)
    model_version: str
    disclaimer: str


class Metric(BaseModel):
    label: str
    value: float
    ci: tuple[float, float]


class SubgroupRow(BaseModel):
    group: str
    n: int
    auroc: float
    ece: float


class BaselineRow(BaseModel):
    model: str
    diabetes: float
    hypertension: float
    cvd: float


class CalibrationPoint(BaseModel):
    predicted: float
    observed: float


class ModelCard(BaseModel):
    """Evaluation summary served by /model/card. Built only from real held-out results."""

    model_version: str
    mode: FeatureMode
    metrics: list[Metric]
    calibration: list[CalibrationPoint]
    subgroups: list[SubgroupRow]
    baselines: list[BaselineRow]
