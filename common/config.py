"""Project-wide constants: seeds, target names and plausible clinical ranges."""
from __future__ import annotations

import random

import numpy as np

SEED: int = 42

TARGETS: tuple[str, ...] = ("diabetes", "hypertension", "cvd")

# Plausible physiological ranges (min, max) for adult inputs. Values outside are rejected.
CLINICAL_RANGES: dict[str, tuple[float, float]] = {
    "age": (18, 110),
    "bmi": (10, 80),
    "sbp": (60, 260),
    "dbp": (30, 150),
    "fasting_glucose": (30, 600),
    "hba1c": (3, 20),
    "total_cholesterol": (50, 500),
    "hdl": (10, 150),
    "ldl": (10, 400),
    "triglycerides": (20, 2000),
    "income_ratio": (0, 5),  # ratio of family income to the federal poverty line, NHANES caps at 5
}

# NHANES-coded categorical fields (kept as small integer codes to match the training data).
RACE_ETHNICITY_OPTIONS: dict[int, str] = {
    1: "Mexican American", 2: "Other Hispanic", 3: "Non-Hispanic White",
    4: "Non-Hispanic Black", 5: "Other / multiracial",
}
EDUCATION_OPTIONS: dict[int, str] = {
    1: "Less than 9th grade", 2: "9th-11th grade", 3: "High school graduate / GED",
    4: "Some college or AA degree", 5: "College graduate or above",
}

DISCLAIMER: str = (
    "This output comes from an assistive Decision Support Tool. It is not a diagnosis and "
    "requires review and sign-off by a licensed physician."
)


def set_global_seed(seed: int = SEED) -> None:
    """Fix random seeds for python and numpy (xgboost/sklearn take random_state=seed)."""
    random.seed(seed)
    np.random.seed(seed)
