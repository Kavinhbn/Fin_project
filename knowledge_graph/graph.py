"""networkx view of the OKF bundle for validating disease-interaction claims."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import networkx as nx

from knowledge_graph.okf import Bundle, Claim, load_bundle


@dataclass(frozen=True)
class Evidence:
    """A note supporting one claim, with the URLs a reviewer can open."""

    kind: str
    source: str
    target: str
    note_id: str
    title: str
    verified_url: str
    source_urls: tuple[str, ...]
    status: str
    detail: str = ""
    guideline: str = ""


def _evidence(bundle: Bundle, note_id: str, claim: Claim) -> Evidence:
    note = bundle.notes[note_id]
    return Evidence(
        kind=claim.kind, source=claim.source, target=claim.target, note_id=note_id,
        title=note.title, verified_url=note.verified_url,
        source_urls=tuple(s.resource for s in note.sources), status=note.status,
        detail=claim.detail, guideline=claim.guideline,
    )


def build_graph(bundle: Bundle) -> nx.DiGraph:
    """Entities are nodes; each edge carries ``evidence``: list[Evidence].

    Undirected claims (e.g. association) are added in both directions.
    """
    graph: nx.DiGraph = nx.DiGraph()
    graph.add_nodes_from(bundle.entities)
    for note_id, note in bundle.notes.items():
        for claim in note.claims:
            pairs = [(claim.source, claim.target)]
            if not claim.directed:
                pairs.append((claim.target, claim.source))
            for a, b in pairs:
                if not graph.has_edge(a, b):
                    graph.add_edge(a, b, evidence=[])
                graph[a][b]["evidence"].append(_evidence(bundle, note_id, claim))
    return graph


@lru_cache(maxsize=1)
def _default_graph() -> nx.DiGraph:
    return build_graph(load_bundle())


def _g(graph: nx.DiGraph | None) -> nx.DiGraph:
    return graph if graph is not None else _default_graph()


def _edge_evidence(graph: nx.DiGraph, a: str, b: str) -> list[Evidence]:
    data: dict[str, Any] = graph.get_edge_data(a, b) or {}
    return list(data.get("evidence", []))


def edges_between(a: str, b: str, graph: nx.DiGraph | None = None) -> list[Evidence]:
    """All claims linking a and b in either direction (each Evidence has source/target)."""
    g = _g(graph)
    return _edge_evidence(g, a, b) + _edge_evidence(g, b, a)


def evidence_for(source: str, target: str, graph: nx.DiGraph | None = None) -> list[Evidence]:
    """Notes and URLs supporting the directional claim ``source -> target`` (any kind)."""
    return _edge_evidence(_g(graph), source, target)


def supports_claim(
    claim_kind: str, source: str, target: str, graph: nx.DiGraph | None = None
) -> list[Evidence]:
    """Evidence of the given kind for ``source -> target``; empty list means unsupported.

    Kinds in the bundle: ``risk_increase``, ``association``, ``threshold``.
    """
    return [e for e in evidence_for(source, target, graph) if e.kind == claim_kind]
