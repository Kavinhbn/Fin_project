import pytest
from pydantic import ValidationError

from api.schemas import PatientInput
from data_preprocessing.features import assert_no_leakage, select_features
from data_preprocessing.validation import ClinicalValidationError, validate_record


def test_strict_removes_defining_features():
    assert "LBXGH" not in select_features("diabetes", "strict")
    assert "SBP_MEAN" not in select_features("hypertension", "strict")
    assert "LBXGH" in select_features("diabetes", "full")
    assert "LBXGH" in select_features("cvd", "strict")


def test_unknown_target_or_mode():
    with pytest.raises(ValueError):
        select_features("cancer")
    with pytest.raises(ValueError):
        select_features("cvd", "loose")


def test_assert_no_leakage():
    with pytest.raises(ValueError):
        assert_no_leakage(["LBXGH", "RIDAGEYR"], "diabetes")
    assert_no_leakage(["RIDAGEYR"], "diabetes")


def test_validate_record_ok_and_missing_optional():
    assert validate_record({"age": 50, "bmi": 27, "hba1c": None}, required=("age", "bmi")) == {
        "age": 50.0, "bmi": 27.0}


def test_validate_record_collects_all_problems():
    with pytest.raises(ClinicalValidationError) as e:
        validate_record({"age": 500, "sbp": 80, "dbp": 90, "bmi": "abc"}, required=("hdl",))
    msg = str(e.value)
    assert "age" in msg and "sbp must be greater" in msg and "bmi" in msg and "hdl" in msg


def test_api_schema_rejects_out_of_range_and_bp_order():
    PatientInput(age=45, sex="male", bmi=26)
    with pytest.raises(ValidationError):
        PatientInput(age=45, sex="male", bmi=200)
    with pytest.raises(ValidationError):
        PatientInput(age=45, sex="male", bmi=26, sbp=80, dbp=90)
