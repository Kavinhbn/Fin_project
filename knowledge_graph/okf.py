"""Loader for the Open Knowledge Format (OKF v0.2) bundle in ``okf_bundle/``.

OKF: a directory of markdown files with YAML frontmatter. The spec itself is permissive
(broken links and missing optional fields must be tolerated). This loader is deliberately
stricter for project use: it enforces the project fields (title, description, status,
verified_url, sources) and raises on broken links / duplicate ids unless ``strict=False``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

DEFAULT_BUNDLE = Path(__file__).parent / "okf_bundle"
RESERVED = {"index.md", "log.md"}
_LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\(([^)\s]+)\)")


class OKFError(Exception):
    """Base class for bundle errors."""


class FrontmatterError(OKFError):
    """Missing or unparseable frontmatter, or a missing required field."""


class BrokenLinkError(OKFError):
    """A cross-link points at a concept that does not exist."""


class DuplicateIdError(OKFError):
    """Two notes resolve to the same id."""


@dataclass(frozen=True)
class Source:
    """One entry of the OKF ``sources`` list."""

    id: str
    resource: str
    title: str


@dataclass(frozen=True)
class Claim:
    """A machine-readable assertion (project extension key ``claims``)."""

    kind: str
    source: str
    target: str
    directed: bool = True
    detail: str = ""
    guideline: str = ""


@dataclass
class Note:
    """One concept document."""

    id: str
    type: str
    title: str
    description: str
    status: str
    verified_url: str
    resource: str
    tags: list[str]
    sources: list[Source]
    entities: list[str]
    claims: list[Claim]
    body: str
    links: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class Bundle:
    """A loaded bundle: notes keyed by id."""

    root: Path
    notes: dict[str, Note]

    @property
    def entities(self) -> set[str]:
        """All entity names declared by any note."""
        return {e for n in self.notes.values() for e in n.entities}


def _split_frontmatter(text: str, where: str) -> tuple[dict[str, Any], str]:
    """Split ``---`` delimited YAML frontmatter from the markdown body."""
    if not text.startswith("---"):
        raise FrontmatterError(f"{where}: missing YAML frontmatter")
    parts = re.split(r"^---\s*$", text, maxsplit=2, flags=re.MULTILINE)
    if len(parts) < 3:
        raise FrontmatterError(f"{where}: unterminated frontmatter")
    try:
        data = yaml.safe_load(parts[1])
    except yaml.YAMLError as exc:
        raise FrontmatterError(f"{where}: invalid YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise FrontmatterError(f"{where}: frontmatter is not a mapping")
    return data, parts[2]


def _resolve_link(target: str, file: Path, root: Path) -> Path:
    """Resolve a bundle-absolute (``/x.md``) or relative link to a filesystem path."""
    target = target.split("#", 1)[0]
    base = root if target.startswith("/") else file.parent
    return (base / target.lstrip("/")).resolve()


def _require(data: dict[str, Any], key: str, where: str) -> Any:
    value = data.get(key)
    if value in (None, "", []):
        raise FrontmatterError(f"{where}: missing required field '{key}'")
    return value


def load_bundle(root: Path | str = DEFAULT_BUNDLE, strict: bool = True) -> Bundle:
    """Load and validate a bundle.

    With ``strict`` (default) broken links raise :class:`BrokenLinkError`; with
    ``strict=False`` they are dropped, as the OKF spec allows consumers to tolerate them.
    Duplicate ids and missing required fields always raise.
    """
    root_path = Path(root).resolve()
    if not root_path.is_dir():
        raise OKFError(f"bundle directory not found: {root_path}")
    files = sorted(p for p in root_path.rglob("*.md") if p.name not in RESERVED)
    path_to_id = {p.resolve(): p.relative_to(root_path).with_suffix("").as_posix() for p in files}
    notes: dict[str, Note] = {}
    for path in files:
        where = path.relative_to(root_path).as_posix()
        data, body = _split_frontmatter(path.read_text(encoding="utf-8"), where)
        note_id = str(data.get("id") or path_to_id[path.resolve()])
        if note_id in notes:
            raise DuplicateIdError(f"duplicate note id '{note_id}' ({where})")
        for key in ("type", "title", "description", "status", "verified_url", "sources"):
            _require(data, key, where)
        sources = [
            Source(str(s.get("id", "")), str(_require(s, "resource", where)), str(s.get("title", "")))
            for s in data["sources"]
        ]
        claims = [Claim(
            kind=str(c["kind"]), source=str(c["source"]), target=str(c["target"]),
            directed=bool(c.get("directed", True)), detail=str(c.get("detail", "")),
            guideline=str(c.get("guideline", "")),
        ) for c in data.get("claims") or []]
        links: list[str] = []
        for raw in _LINK_RE.findall(body):
            if re.match(r"^[a-z]+:", raw):
                continue
            dest = _resolve_link(raw, path, root_path)
            if dest in path_to_id:
                links.append(path_to_id[dest])
            elif strict:
                raise BrokenLinkError(f"{where}: broken link '{raw}'")
        known = {"id", "type", "title", "description", "status", "verified_url", "resource",
                 "tags", "sources", "entities", "claims"}
        notes[note_id] = Note(
            id=note_id, type=str(data["type"]), title=str(data["title"]),
            description=str(data["description"]), status=str(data["status"]),
            verified_url=str(data["verified_url"]), resource=str(data.get("resource", "")),
            tags=[str(t) for t in data.get("tags") or []], sources=sources,
            entities=[str(e) for e in data.get("entities") or []], claims=claims,
            body=body, links=links, extra={k: v for k, v in data.items() if k not in known},
        )
    bundle = Bundle(root_path, notes)
    entities = bundle.entities
    for note in notes.values():
        for c in note.claims:
            for end in (c.source, c.target):
                if end not in entities:
                    raise OKFError(f"{note.id}: claim references undeclared entity '{end}'")
    return bundle
