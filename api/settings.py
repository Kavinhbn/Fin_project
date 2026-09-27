"""Runtime settings read from environment variables (Secret Manager injects these in GCP)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Literal

from common.schemas import Role


def _csv(name: str) -> frozenset[str]:
    return frozenset(v.strip().lower() for v in os.environ.get(name, "").split(",") if v.strip())


@dataclass(frozen=True)
class Settings:
    """`auth_mode='dev'` is for local work only; production must use 'iap'."""

    auth_mode: Literal["dev", "iap"] = "dev"
    dev_role: Role = "clinician"
    dev_email: str = "dev@example.org"
    iap_audience: str = ""
    admin_emails: frozenset[str] = field(default_factory=frozenset)
    clinician_emails: frozenset[str] = field(default_factory=frozenset)
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    rate_limit_per_min: int = 60

    def __post_init__(self) -> None:
        if self.auth_mode == "iap" and not self.iap_audience:
            raise ValueError("IAP_AUDIENCE must be set when AUTH_MODE=iap")

    @classmethod
    def from_env(cls) -> Settings:
        mode = os.environ.get("AUTH_MODE", "dev")
        if mode not in ("dev", "iap"):
            raise ValueError("AUTH_MODE must be 'dev' or 'iap'")
        role = os.environ.get("DEV_ROLE", "clinician")
        if role not in ("clinician", "viewer", "admin"):
            raise ValueError("DEV_ROLE must be clinician, viewer or admin")
        origins = tuple(o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip())
        return cls(
            auth_mode=mode,  # type: ignore[arg-type]
            dev_role=role,  # type: ignore[arg-type]
            dev_email=os.environ.get("DEV_EMAIL", "dev@example.org"),
            iap_audience=os.environ.get("IAP_AUDIENCE", ""),
            admin_emails=_csv("ADMIN_EMAILS"),
            clinician_emails=_csv("CLINICIAN_EMAILS"),
            cors_origins=origins,
            rate_limit_per_min=int(os.environ.get("RATE_LIMIT_PER_MIN", "60")),
        )
