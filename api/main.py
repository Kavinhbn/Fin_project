"""FastAPI application. Run locally: `uvicorn api.main:app --reload` (dev auth, in-memory store)."""
from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from api import service
from api.auth import JwtVerifier, authenticate, verify_iap_jwt
from api.ratelimit import RateLimiter
from api.settings import Settings
from api.store import InMemoryRepository, Repository
from common.config import DISCLAIMER
from common.schemas import (
    Assessment,
    AuditEntry,
    CreateAssessmentRequest,
    FeatureMode,
    Me,
    ModelCard,
    ReviewRequest,
)
from llm.note import NoteWriter
from models.base import RiskModel
from models.placeholder import PlaceholderModel
from models.trained import TrainedRiskModel

log = logging.getLogger("api")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}


def create_app(
    settings: Settings | None = None,
    repo: Repository | None = None,
    model: RiskModel | None = None,
    writer: NoteWriter | None = None,
    jwt_verifier: JwtVerifier = verify_iap_jwt,
) -> FastAPI:
    """Application factory; every dependency is injectable for tests."""
    cfg = settings or Settings.from_env()
    store: Repository = repo or InMemoryRepository()
    risk_model: RiskModel = model or TrainedRiskModel.load() or PlaceholderModel()
    limiter = RateLimiter(cfg.rate_limit_per_min)

    app = FastAPI(title="Triad API", version="0.1.0", docs_url="/docs" if cfg.auth_mode == "dev" else None, redoc_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=list(cfg.cors_origins), allow_credentials=True,
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-Dev-Role"])

    @app.middleware("http")
    async def harden(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            response.headers[k] = v
        response.headers["X-Request-ID"] = request_id
        return response

    def current_user(request: Request) -> Me:
        user = authenticate(request, cfg, jwt_verifier)
        limiter.check(user.email)
        return user

    def writer_user(user: Me = Depends(current_user)) -> Me:
        if user.role == "viewer":
            raise HTTPException(status_code=403, detail="Your role is read-only.")
        return user

    def admin_user(user: Me = Depends(current_user)) -> Me:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="The audit log is available to administrators only.")
        return user

    def _translate(exc: Exception) -> HTTPException:
        if isinstance(exc, service.NotFound):
            return HTTPException(status_code=404, detail="Assessment not found")
        if isinstance(exc, service.Conflict):
            return HTTPException(status_code=409, detail=str(exc))
        if isinstance(exc, service.Invalid):
            return HTTPException(status_code=404, detail=str(exc))
        raise exc

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/me", response_model=Me)
    def me(user: Me = Depends(current_user)) -> Me:
        return user

    @app.get("/disclaimer")
    def disclaimer(_: Me = Depends(current_user)) -> dict[str, str | None]:
        if risk_model.is_placeholder:
            notice: str | None = "Placeholder model: estimates are not clinically valid and are for interface testing only."
        else:
            notice = getattr(risk_model, "notice", None)
        return {"disclaimer": DISCLAIMER, "notice": notice}

    @app.post("/assessments", response_model=Assessment, status_code=201)
    def create(req: CreateAssessmentRequest, user: Me = Depends(writer_user)) -> Assessment:
        return service.create_assessment(store, risk_model, user, req)

    @app.get("/assessments", response_model=list[Assessment])
    def list_assessments(mode: FeatureMode = Query("strict"), _: Me = Depends(current_user)) -> list[Assessment]:
        return store.list_by_mode(mode)

    @app.get("/assessments/{assessment_id}", response_model=Assessment)
    def get_assessment(assessment_id: str, _: Me = Depends(current_user)) -> Assessment:
        found = store.get(assessment_id)
        if found is None:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return found

    @app.post("/assessments/{assessment_id}/note", response_model=Assessment)
    def note(assessment_id: str, user: Me = Depends(writer_user)) -> Assessment:
        try:
            return service.generate_note(store, user, assessment_id, writer)
        except (service.NotFound, service.Conflict, service.Invalid) as exc:
            raise _translate(exc) from exc

    @app.post("/assessments/{assessment_id}/review", response_model=Assessment)
    def review(assessment_id: str, body: ReviewRequest, user: Me = Depends(writer_user)) -> Assessment:
        try:
            return service.review_note(store, user, assessment_id, body.version)
        except (service.NotFound, service.Conflict, service.Invalid) as exc:
            raise _translate(exc) from exc

    @app.get("/model/card")
    def model_card(mode: FeatureMode = Query("strict"), _: Me = Depends(current_user)) -> ModelCard:
        # A card is served only from a real evaluated model; never invent metrics.
        card = getattr(risk_model, "card", None)
        if risk_model.is_placeholder or card is None:
            raise HTTPException(status_code=404, detail="No evaluated model is registered yet.")
        return card(mode)

    @app.get("/audit", response_model=list[AuditEntry])
    def audit(_: Me = Depends(admin_user)) -> list[AuditEntry]:
        return store.list_audit()

    return app


def _default_app() -> FastAPI:
    return create_app()


app = _default_app()
