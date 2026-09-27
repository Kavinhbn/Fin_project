"""Tests for the OKF knowledge bundle, loader and graph."""
from __future__ import annotations

from pathlib import Path

import pytest

from knowledge_graph.graph import build_graph, edges_between, evidence_for, supports_claim
from knowledge_graph.okf import (
    BrokenLinkError,
    DuplicateIdError,
    FrontmatterError,
    load_bundle,
)

NOTE = """---
type: Test
title: T
description: D
status: needs_clinician_review
verified_url: https://example.org
sources:
  - {{id: a, resource: "https://example.org", title: A}}
---

{body}
"""


def _write(root: Path, name: str, body: str = "text") -> None:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(NOTE.format(body=body), encoding="utf-8")


def test_bundle_loads_with_expected_size() -> None:
    """The shipped bundle loads and has 15-25 notes."""
    assert 15 <= len(load_bundle().notes) <= 25


def test_every_note_has_source_url_and_status() -> None:
    """Every note carries status, verified_url and https sources."""
    for note in load_bundle().notes.values():
        assert note.status == "needs_clinician_review"
        assert note.verified_url.startswith("https://")
        assert note.sources
        assert all(s.resource.startswith("https://") for s in note.sources)


def test_no_broken_links() -> None:
    """Strict load succeeds, so all cross-links resolve."""
    bundle = load_bundle(strict=True)
    assert any(n.links for n in bundle.notes.values())


def test_evidence_lookup_directional() -> None:
    """Diabetes -> CVD is supported; the reverse is not."""
    ev = supports_claim("risk_increase", "diabetes", "cvd")
    assert ev and ev[0].verified_url.startswith("https://www.cdc.gov")
    assert evidence_for("cvd", "diabetes") == []
    assert supports_claim("risk_increase", "hypertension", "cvd")
    assert supports_claim("risk_increase", "hypertension", "diabetes") == []


def test_association_and_thresholds() -> None:
    """Co-occurrence is symmetric; both BP thresholds and diabetes thresholds are present."""
    assert supports_claim("association", "diabetes", "hypertension")
    assert supports_claim("association", "hypertension", "diabetes")
    assert len(supports_claim("threshold", "blood_pressure", "hypertension")) == 2
    assert supports_claim("threshold", "hba1c", "diabetes")
    assert edges_between("hypertension", "diabetes")


def test_graph_nodes_include_shared_risk_factors() -> None:
    """Shared risk factors connect to all three condition nodes."""
    graph = build_graph(load_bundle())
    for factor in ("obesity", "physical_inactivity"):
        assert graph.has_edge(factor, "cvd")
    assert graph.has_edge("obesity", "diabetes")


def test_broken_link_raises(tmp_path: Path) -> None:
    """A link to a missing note raises in strict mode and is tolerated otherwise."""
    _write(tmp_path, "a.md", "see [x](/missing.md)")
    with pytest.raises(BrokenLinkError):
        load_bundle(tmp_path)
    assert "a" in load_bundle(tmp_path, strict=False).notes


def test_duplicate_id_raises(tmp_path: Path) -> None:
    """Explicit duplicate ids are rejected."""
    for name in ("a.md", "b.md"):
        (tmp_path / name).write_text(
            NOTE.format(body="x").replace("type: Test", "id: same\ntype: Test"), encoding="utf-8"
        )
    with pytest.raises(DuplicateIdError):
        load_bundle(tmp_path)


def test_missing_required_field_raises(tmp_path: Path) -> None:
    """A note without verified_url is rejected."""
    text = NOTE.format(body="x").replace("verified_url: https://example.org\n", "")
    (tmp_path / "a.md").write_text(text, encoding="utf-8")
    with pytest.raises(FrontmatterError):
        load_bundle(tmp_path)
