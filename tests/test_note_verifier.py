from datetime import datetime, timezone

from common.config import DISCLAIMER
from common.schemas import Assessment, PatientInput
from llm.note import Claim, TemplateWriter, build_note, verify, verify_claim
from models.placeholder import PlaceholderModel


def make_assessment() -> Assessment:
    x = PatientInput(age=58, sex="male", bmi=31, sbp=148, dbp=92, hba1c=6.6, smoker=True)
    out = PlaceholderModel().predict(x, "full")
    return Assessment(id="A-1", version=1, created_at=datetime.now(timezone.utc), created_by="t", mode="full", input=x,
                      risks=out.risks, explanation=out.explanation, cvd_pathways=out.cvd_pathways,
                      model_version="t", disclaimer=DISCLAIMER)


def test_template_writer_claims_all_verify():
    a = make_assessment()
    claims = TemplateWriter().write(a)
    kept, result = verify(claims, a)
    assert result.flagged == [] and len(kept) == len(claims) > 10


def test_wrong_probability_is_flagged_and_dropped_from_text():
    a = make_assessment()
    actual = round(a.risks["cvd"].probability * 100)
    bad = Claim(section="assessment", kind="probability", disease="cvd", percent=(actual + 20) % 100)
    kept, result = verify([bad], a)
    assert kept == [] and result.passed == 0
    assert f"{actual}%" in result.flagged[0].reason


def test_wrong_direction_driver_and_pathway_flagged():
    a = make_assessment()
    top = a.explanation["diabetes"].positive[0].feature
    wrong_dir = Claim(section="catalysts", kind="driver", disease="diabetes", feature=top, direction="lowers")
    fake_feature = Claim(section="catalysts", kind="driver", disease="cvd", feature="Astrology", direction="raises")
    bad_path = Claim(section="cross_disease", kind="pathway", disease="cvd", pathway="via_diabetes", percent=99)
    _, result = verify([wrong_dir, fake_feature, bad_path], a)
    assert len(result.flagged) == 3


def test_dosing_language_is_blocked():
    a = make_assessment()
    for text in ("Start taking 500 mg metformin.", "Prescribe a statin.", "Increase the dose."):
        _, result = verify([Claim(section="next_steps", kind="advice", text=text)], a)
        assert len(result.flagged) == 1, text


def test_build_note_has_four_sections_and_only_verified_text():
    a = make_assessment()

    class Liar:
        def write(self, assessment):
            good = TemplateWriter().write(assessment)
            return [*good, Claim(section="assessment", kind="probability", disease="diabetes", percent=1)]

    note = build_note(a, Liar())
    assert [s.title for s in note.sections] == [
        "Primary Clinical Assessment", "Identified Risk Catalysts", "Cross-Disease Impact", "Recommended Next Steps"]
    assert len(note.verifier.flagged) == 1
    assert "diabetes: 1%" not in " ".join(s.body for s in note.sections)


def test_guideline_conflict_blocks_mediator_wrong_direction():
    from llm.note import guideline_conflict
    reason = guideline_conflict("diabetes", "cvd", "lowers")
    assert reason is not None and "cdc.gov" in reason.lower()
    assert guideline_conflict("diabetes", "cvd", "raises") is None


def test_guideline_conflict_silent_on_unmapped_pair():
    from llm.note import guideline_conflict
    assert guideline_conflict("smoking", "diabetes", "lowers") is None  # no direct edge in the bundle


def test_raw_feature_driver_claims_are_never_blocked_by_the_guideline_graph():
    """A per-patient SHAP sign can legitimately disagree with the population-level relationship
    (BMI/Age/Smoking do this often; see the note above MEDIATOR_ENTITY in llm/note.py). Only the
    two engineered mediator features are checked directionally."""
    a = make_assessment()
    claim = Claim(section="catalysts", kind="driver", disease="cvd", feature="BMI", direction="raises")
    assert verify_claim(claim, a) is None or "guideline" not in (verify_claim(claim, a) or "").lower()
    claim = Claim(section="catalysts", kind="driver", disease="diabetes", feature="Age", direction="lowers")
    assert verify_claim(claim, a) is None or "guideline" not in (verify_claim(claim, a) or "").lower()


def test_mediator_driver_claim_checked_against_guidelines():
    a = make_assessment()
    # placeholder model: Diabetes (predicted)/Hypertension (predicted) are always positive CVD drivers
    good = Claim(section="catalysts", kind="driver", disease="cvd", feature="Diabetes (predicted)", direction="raises")
    assert verify_claim(good, a) is None
    bad = Claim(section="catalysts", kind="driver", disease="cvd", feature="Diabetes (predicted)", direction="lowers")
    reason = verify_claim(bad, a)
    assert reason is not None  # not in a.explanation['cvd'].negative -> caught by the model-based check first


def test_pathway_claims_require_knowledge_graph_support():
    from llm.note import supports_claim_any
    assert supports_claim_any("diabetes", "cvd") and supports_claim_any("hypertension", "cvd")
    a = make_assessment()
    claim = Claim(section="cross_disease", kind="pathway", disease="cvd", pathway="via_diabetes",
                  percent=round(a.cvd_pathways.via_diabetes * 100))
    assert verify_claim(claim, a) is None


def test_broken_bundle_degrades_to_model_only_checks(monkeypatch):
    """If the knowledge graph is unavailable, notes must still generate (fail open, not closed)."""
    import knowledge_graph.graph as kg

    def boom(*a, **k):
        raise RuntimeError("bundle unavailable")

    monkeypatch.setattr(kg, "supports_claim", boom)
    a = make_assessment()
    note = build_note(a, TemplateWriter())
    assert note.verifier.flagged == []
