"""Clinical note: structured claims -> rendered text -> deterministic verification.

Design: a writer (a template today, an LLM later) produces *structured claims*, never free
text. Each claim is checked against the model output before anything is shown, and the
disclaimer is appended by code. This makes verification exact instead of fuzzy.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Literal, Protocol

from pydantic import BaseModel

from common.schemas import (
    Assessment,
    Disease,
    FlaggedClaim,
    Note,
    NoteSection,
    VerifierResult,
)

LABEL: dict[Disease, str] = {"diabetes": "diabetes", "hypertension": "hypertension", "cvd": "cardiovascular disease"}

# Treatment orders and dosing are out of scope for this tool.
FORBIDDEN = re.compile(r"\b(\d+\s?(mg|mcg|ml|units?)|dose|dosage|prescribe|start taking|stop taking)\b", re.IGNORECASE)

# Directional guideline conflict checking is intentionally NOT applied to raw clinical
# features (Age, BMI, cholesterol, ...): empirically, a per-patient SHAP attribution for a raw
# feature legitimately flips sign from the population-level relationship when features are
# correlated (e.g. BMI "lowers" one patient's CVD estimate once age and blood pressure already
# explain most of their risk) even though "obesity raises CVD risk" is true on average. Checked
# on 25 synthetic patients against the trained cascade: BMI, Age and Smoking each flipped sign
# for several patients, while the two engineered mediator features never did (see
# tests/test_note_verifier.py). So only the mediator driver claims — the literal subject of the
# cascade's "diabetes/hypertension feed CVD" claim — are checked directionally; the pathway
# claims (Cross-Disease Impact section) get a population-level presence check instead of a
# directional one, since their share is non-negative by construction.
MEDIATOR_ENTITY: dict[str, str] = {"Diabetes (predicted)": "diabetes", "Hypertension (predicted)": "hypertension"}
DISEASE_ENTITY: dict[Disease, str] = {"diabetes": "diabetes", "hypertension": "hypertension", "cvd": "cvd"}
GUIDELINE_KINDS = ("risk_increase", "association")


def _graph_evidence(kind: str, source_entity: str, target_entity: str) -> list[object]:
    """Import and call inside one try/except: a missing bundle OR a broken graph function must
    both degrade gracefully (fail open), not just a missing import."""
    try:
        from knowledge_graph.graph import supports_claim
        return list(supports_claim(kind, source_entity, target_entity))
    except Exception:  # noqa: BLE001 - intentional fail-open if the knowledge bundle is broken
        return []


def supports_claim_any(source_entity: str, target_entity: str) -> bool:
    """True if the knowledge graph documents `source -> target` as risk-increasing or
    associated. Degrades to True (do not block on a missing/broken bundle) if the graph
    cannot be loaded — the numeric model-based checks are the load-bearing ones."""
    try:
        from knowledge_graph.graph import supports_claim
        return any(supports_claim(kind, source_entity, target_entity) for kind in GUIDELINE_KINDS)
    except Exception:  # noqa: BLE001 - intentional fail-open if the knowledge bundle is broken
        return True


def guideline_conflict(source_entity: str, target_entity: str, direction: Literal["raises", "lowers"]) -> str | None:
    """None if `direction` agrees with the guideline graph (or the graph is silent on the pair,
    or the graph cannot be loaded — the numeric model-based check is the load-bearing one); a
    reason string, with a source URL, if the graph documents the opposite direction."""
    if direction == "raises":
        return None  # only a *documented increase* can contradict a claimed decrease
    for kind in GUIDELINE_KINDS:
        evidence = _graph_evidence(kind, source_entity, target_entity)
        if evidence:
            e = evidence[0]
            return (f"Clinical guidelines ({e.title}, {e.verified_url}) document that this factor "  # type: ignore[attr-defined]
                    f"raises risk, not lowers it.")
    return None


class Claim(BaseModel):
    """One checkable statement. `kind` decides how it is verified."""

    section: Literal["assessment", "catalysts", "cross_disease", "next_steps"]
    kind: Literal["probability", "driver", "pathway", "advice"]
    disease: Disease | None = None
    feature: str | None = None
    direction: Literal["raises", "lowers"] | None = None
    pathway: Literal["via_diabetes", "via_hypertension", "direct"] | None = None
    percent: int | None = None
    text: str | None = None  # advice only


class NoteWriter(Protocol):
    """Anything that turns an assessment into structured claims (template or LLM)."""

    def write(self, assessment: Assessment) -> list[Claim]: ...


SECTION_TITLES: dict[str, str] = {
    "assessment": "Primary Clinical Assessment",
    "catalysts": "Identified Risk Catalysts",
    "cross_disease": "Cross-Disease Impact",
    "next_steps": "Recommended Next Steps",
}
PATH_LABEL = {"via_diabetes": "through predicted diabetes", "via_hypertension": "through predicted hypertension", "direct": "directly"}

ADVICE = [
    "Confirm with fasting glucose or HbA1c and repeated blood-pressure readings.",
    "Review the lipid panel and smoking status.",
    "Discuss lifestyle measures. Treatment decisions rest with the clinician.",
]


class TemplateWriter:
    """Deterministic stand-in for the LLM writer; emits only claims that are true by construction."""

    def write(self, a: Assessment) -> list[Claim]:
        claims: list[Claim] = []
        for d in ("diabetes", "hypertension", "cvd"):
            claims.append(Claim(section="assessment", kind="probability", disease=d, percent=round(a.risks[d].probability * 100)))
            for drv in a.explanation[d].positive:
                claims.append(Claim(section="catalysts", kind="driver", disease=d, feature=drv.feature, direction="raises"))
            for drv in a.explanation[d].negative:
                claims.append(Claim(section="catalysts", kind="driver", disease=d, feature=drv.feature, direction="lowers"))
        for p in ("via_diabetes", "via_hypertension", "direct"):
            claims.append(Claim(section="cross_disease", kind="pathway", disease="cvd", pathway=p, percent=round(getattr(a.cvd_pathways, p) * 100)))
        claims.extend(Claim(section="next_steps", kind="advice", text=t) for t in ADVICE)
        return claims


def render(claim: Claim) -> str:
    """Turn one claim into a sentence."""
    if claim.kind == "probability" and claim.disease and claim.percent is not None:
        return f"Estimated probability of {LABEL[claim.disease]}: {claim.percent}%."
    if claim.kind == "driver" and claim.disease and claim.feature and claim.direction:
        return f"{claim.feature} {claim.direction} the {LABEL[claim.disease]} estimate."
    if claim.kind == "pathway" and claim.pathway and claim.percent is not None:
        return f"About {claim.percent}% of the modelled cardiovascular estimate operates {PATH_LABEL[claim.pathway]}."
    return claim.text or ""


def verify_claim(claim: Claim, a: Assessment) -> str | None:
    """Return None if the claim matches the model output, else the reason it does not."""
    if claim.kind == "probability" and claim.disease:
        actual = round(a.risks[claim.disease].probability * 100)
        return None if claim.percent == actual else f"Model estimate is {actual}%, not {claim.percent}%."
    if claim.kind == "driver" and claim.disease and claim.feature and claim.direction:
        expl = a.explanation[claim.disease]
        pool = expl.positive if claim.direction == "raises" else expl.negative
        if not any(d.feature == claim.feature for d in pool):
            return f"{claim.feature} is not among the top-3 factors that {claim.direction} {LABEL[claim.disease]} risk."
        source = MEDIATOR_ENTITY.get(claim.feature)
        if source:
            return guideline_conflict(source, DISEASE_ENTITY[claim.disease], claim.direction)
        return None
    if claim.kind == "pathway" and claim.pathway:
        actual = round(getattr(a.cvd_pathways, claim.pathway) * 100)
        if claim.percent != actual:
            return f"Modelled share is {actual}%, not {claim.percent}%."
        if claim.pathway in ("via_diabetes", "via_hypertension"):
            mediator = "diabetes" if claim.pathway == "via_diabetes" else "hypertension"
            if not supports_claim_any(mediator, "cvd"):
                return (f"No supporting guideline evidence in the knowledge base for "
                        f"{mediator} raising cardiovascular disease risk.")
        return None
    if claim.kind == "advice":
        text = claim.text or ""
        return "Advice contains dosing or treatment-order language." if FORBIDDEN.search(text) else None
    return "Claim is malformed."


def verify(claims: list[Claim], a: Assessment) -> tuple[list[Claim], VerifierResult]:
    """Keep only verified claims; report the rest as flagged."""
    kept: list[Claim] = []
    flagged: list[FlaggedClaim] = []
    for claim in claims:
        reason = verify_claim(claim, a)
        if reason is None:
            kept.append(claim)
        else:
            flagged.append(FlaggedClaim(claim=render(claim) or claim.kind, reason=reason))
    return kept, VerifierResult(checked=len(claims), passed=len(kept), flagged=flagged)


def _join(names: list[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def render_section(key: str, claims: list[Claim]) -> str:
    """Render verified claims of one section; driver claims are grouped per disease for readability."""
    if key != "catalysts":
        return " ".join(render(c) for c in claims).strip()
    parts: list[str] = []
    for disease in ("diabetes", "hypertension", "cvd"):
        raises = [c.feature for c in claims if c.disease == disease and c.direction == "raises" and c.feature]
        lowers = [c.feature for c in claims if c.disease == disease and c.direction == "lowers" and c.feature]
        bits = []
        if raises:
            bits.append(f"{_join(raises)} raise{'s' if len(raises) == 1 else ''} the estimate")
        if lowers:
            bits.append(f"{_join(lowers)} lower{'s' if len(lowers) == 1 else ''} it")
        if bits:
            parts.append(f"{LABEL[disease].capitalize()}: {'; '.join(bits)}.")
    return " ".join(parts)


def build_note(a: Assessment, writer: NoteWriter | None = None) -> Note:
    """Write, verify, and assemble a note. Unverified claims never reach the text."""
    claims = (writer or TemplateWriter()).write(a)
    kept, result = verify(claims, a)
    sections: list[NoteSection] = []
    for key, title in SECTION_TITLES.items():
        body = render_section(key, [c for c in kept if c.section == key])
        if body:
            sections.append(NoteSection(title=title, body=body))
    return Note(sections=sections, generated_at=datetime.now(timezone.utc), verifier=result, reviewed_by=None)
