"""Model interface the API depends on. The real trained cascade will implement it."""
from __future__ import annotations

from typing import Protocol

from common.schemas import FeatureMode, ModelOutput, PatientInput


class RiskModel(Protocol):
    """A joint Diabetes/Hypertension/CVD risk model with explanations."""

    version: str
    is_placeholder: bool

    def predict(self, patient: PatientInput, mode: FeatureMode) -> ModelOutput:
        """Return risks, per-disease SHAP-style drivers and CVD pathway shares."""
        ...
