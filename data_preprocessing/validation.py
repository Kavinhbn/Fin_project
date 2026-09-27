"""Clinical input validation with explicit exceptions."""
from __future__ import annotations

import math
from collections.abc import Mapping

from common.config import CLINICAL_RANGES


class ClinicalValidationError(ValueError):
    """Raised for missing, non-numeric or physiologically implausible clinical inputs."""


def validate_record(record: Mapping[str, float | None], required: tuple[str, ...] = ()) -> dict[str, float]:
    """Validate one patient record against CLINICAL_RANGES.

    Fields listed in `required` must be present. Other missing fields are allowed
    (None or absent) and are omitted from the result. Raises ClinicalValidationError
    listing every problem found.
    """
    problems: list[str] = []
    clean: dict[str, float] = {}
    for name in required:
        if record.get(name) is None:
            problems.append(f"{name}: required value is missing")
    for name, value in record.items():
        if value is None or name not in CLINICAL_RANGES:
            continue
        try:
            num = float(value)
        except (TypeError, ValueError):
            problems.append(f"{name}: {value!r} is not a number")
            continue
        low, high = CLINICAL_RANGES[name]
        if math.isnan(num) or not low <= num <= high:
            problems.append(f"{name}: {value!r} outside plausible range [{low}, {high}]")
        else:
            clean[name] = num
    if "sbp" in clean and "dbp" in clean and clean["sbp"] <= clean["dbp"]:
        problems.append("sbp must be greater than dbp")
    if problems:
        raise ClinicalValidationError("; ".join(problems))
    return clean
