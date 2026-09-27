"""Use-case logic: create, note, review. Keeps main.py thin and testable."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from api.store import Repository, VersionConflict
from common.config import DISCLAIMER
from common.schemas import Assessment, AuditEntry, CreateAssessmentRequest, Me
from llm.note import NoteWriter, build_note
from models.base import RiskModel


class NotFound(Exception):
    pass


class Conflict(Exception):
    pass


class Invalid(Exception):
    pass


def input_hash(req: CreateAssessmentRequest, model_version: str) -> str:
    """Stable fingerprint of an assessment input (no identifiers are stored in the audit log)."""
    payload = json.dumps({"i": req.input.model_dump(), "m": req.mode, "v": model_version}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _audit(repo: Repository, a: Assessment, user: Me, verifier: str, fingerprint: str) -> None:
    repo.add_audit(AuditEntry(
        id=repo.next_audit_id(), timestamp=datetime.now(timezone.utc), user=user.email,
        model_version=a.model_version, input_hash=fingerprint, verifier=verifier,  # type: ignore[arg-type]
    ))


def create_assessment(repo: Repository, model: RiskModel, user: Me, req: CreateAssessmentRequest) -> Assessment:
    out = model.predict(req.input, req.mode)
    a = Assessment(
        id=repo.next_id(), version=1, created_at=datetime.now(timezone.utc), created_by=user.email,
        mode=req.mode, input=req.input, risks=out.risks, explanation=out.explanation,
        cvd_pathways=out.cvd_pathways, model_version=model.version, disclaimer=DISCLAIMER, note=None,
    )
    repo.add(a)
    _audit(repo, a, user, "not_run", input_hash(req, model.version))
    return a


def generate_note(repo: Repository, user: Me, assessment_id: str, writer: NoteWriter | None = None) -> Assessment:
    a = repo.get(assessment_id)
    if a is None:
        raise NotFound(assessment_id)
    note = build_note(a, writer)
    updated = a.model_copy(update={"version": a.version + 1, "note": note})
    try:
        repo.update(updated, expected_version=a.version)
    except VersionConflict as exc:
        raise Conflict("The assessment changed while the note was generated. Try again.") from exc
    req = CreateAssessmentRequest(input=a.input, mode=a.mode)
    _audit(repo, updated, user, "flagged" if note.verifier.flagged else "passed", input_hash(req, a.model_version))
    return updated


def review_note(repo: Repository, user: Me, assessment_id: str, version: int) -> Assessment:
    a = repo.get(assessment_id)
    if a is None:
        raise NotFound(assessment_id)
    if a.note is None:
        raise Invalid("There is no note to review.")
    if a.version != version:
        raise Conflict("This assessment changed since you opened it. Reload and try again.")
    updated = a.model_copy(update={"version": a.version + 1, "note": a.note.model_copy(update={"reviewed_by": user.email})})
    try:
        repo.update(updated, expected_version=version)
    except VersionConflict as exc:
        raise Conflict("This assessment changed since you opened it. Reload and try again.") from exc
    return updated
