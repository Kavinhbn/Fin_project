"""Authentication and role resolution.

Production: Google Identity-Aware Proxy signs a JWT in `x-goog-iap-jwt-assertion`; we verify
it (signature, audience, expiry) and map the email to a role. Unknown emails get the
least-privileged role (`viewer`). Dev mode trusts a local header and must never be used
outside a developer machine.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException, Request

from api.settings import Settings
from common.schemas import Me, Role

log = logging.getLogger("api.auth")
IAP_HEADER = "x-goog-iap-jwt-assertion"
IAP_CERTS_URL = "https://www.gstatic.com/iap/verify/public_key"

JwtVerifier = Callable[[str, str], dict[str, Any]]


def verify_iap_jwt(token: str, audience: str) -> dict[str, Any]:
    """Verify an IAP JWT with Google's public keys. Raises ValueError if invalid."""
    from google.auth.transport import requests as g_requests  # imported lazily: only needed in prod
    from google.oauth2 import id_token

    return dict(id_token.verify_token(token, g_requests.Request(), audience=audience, certs_url=IAP_CERTS_URL))


def role_for(email: str, settings: Settings) -> Role:
    """Least privilege by default: only allow-listed emails get more than read-only."""
    e = email.lower()
    if e in settings.admin_emails:
        return "admin"
    if e in settings.clinician_emails:
        return "clinician"
    return "viewer"


DEV_ROLE_COOKIE = "triad_dev_role"
DEV_NAME_COOKIE = "triad_dev_name"


def authenticate(request: Request, settings: Settings, verifier: JwtVerifier = verify_iap_jwt) -> Me:
    """Return the caller's identity or raise 401.

    Dev mode identity, in priority order: the `/auth/dev-login` cookie (set from the UI's
    Settings screen), then the `X-Dev-Role` header (for scripts/tests), then the server's
    configured default. None of this exists in `iap` mode.
    """
    if settings.auth_mode == "dev":
        cookie_role = request.cookies.get(DEV_ROLE_COOKIE, "")
        header_role = request.headers.get("x-dev-role", "")
        picked = cookie_role or header_role
        role: Role = picked if picked in ("clinician", "viewer", "admin") else settings.dev_role  # type: ignore[assignment]
        name = request.cookies.get(DEV_NAME_COOKIE) or "Dev User"
        return Me(email=settings.dev_email, name=name, role=role)

    token = request.headers.get(IAP_HEADER)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        claims = verifier(token, settings.iap_audience)
    except Exception:  # any verification failure is a 401, details go to the log only
        log.warning("IAP token rejected", exc_info=True)
        raise HTTPException(status_code=401, detail="Invalid credentials") from None
    email = str(claims.get("email", "")).lower()
    if not email:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return Me(email=email, name=email.split("@")[0], role=role_for(email, settings))
