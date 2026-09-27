import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.settings import Settings
from api.store import InMemoryRepository
from models.placeholder import PlaceholderModel

VALID = {"age": 58, "sex": "male", "bmi": 31, "sbp": 148, "dbp": 92, "hba1c": 6.6, "smoker": True}


def make(**over) -> TestClient:
    settings = Settings(**over)
    return TestClient(create_app(settings=settings, repo=InMemoryRepository(), model=PlaceholderModel()))


@pytest.fixture()
def client() -> TestClient:
    return make()


def role(r: str) -> dict[str, str]:
    return {"X-Dev-Role": r}


def test_health_and_security_headers(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["x-request-id"]


def test_me_and_disclaimer_flag_placeholder(client):
    assert client.get("/me").json()["role"] == "clinician"
    d = client.get("/disclaimer").json()
    assert "licensed physician" in d["disclaimer"]
    assert "Placeholder" in d["notice"]


def test_create_assessment_shape_and_list(client):
    r = client.post("/assessments", json={"input": VALID, "mode": "strict"})
    assert r.status_code == 201
    a = r.json()
    assert set(a["risks"]) == {"diabetes", "hypertension", "cvd"}
    assert all(0 <= v["probability"] <= 1 for v in a["risks"].values())
    assert a["version"] == 1 and a["note"] is None
    assert abs(sum(a["cvd_pathways"].values()) - 1) < 0.01
    assert "licensed physician" in a["disclaimer"]
    assert [x["id"] for x in client.get("/assessments?mode=strict").json()] == [a["id"]]
    assert client.get("/assessments?mode=full").json() == []
    assert client.get(f"/assessments/{a['id']}").json()["id"] == a["id"]


def test_strict_mode_hides_label_defining_features(client):
    strict = client.post("/assessments", json={"input": VALID, "mode": "strict"}).json()
    full = client.post("/assessments", json={"input": VALID, "mode": "full"}).json()
    names = lambda a, d: {x["feature"] for x in a["explanation"][d]["positive"] + a["explanation"][d]["negative"]}
    assert not names(strict, "hypertension") & {"Systolic BP", "Diastolic BP"}
    assert "Systolic BP" in names(full, "hypertension")


def test_validation_errors_are_422_with_field_locations(client):
    bad = {**VALID, "age": 500}
    r = client.post("/assessments", json={"input": bad})
    assert r.status_code == 422
    assert any(e["loc"][-1] == "age" for e in r.json()["detail"])
    r = client.post("/assessments", json={"input": {**VALID, "sbp": 80, "dbp": 90}})
    assert r.status_code == 422
    assert any(e["loc"][-1] == "dbp" and "sbp must be greater" in e["msg"] for e in r.json()["detail"])
    assert client.post("/assessments", json={"input": VALID, "mode": "nope"}).status_code == 422


def test_unknown_assessment_404(client):
    assert client.get("/assessments/A-9999").status_code == 404
    assert client.post("/assessments/A-9999/note").status_code == 404


def test_viewer_is_read_only(client):
    assert client.post("/assessments", json={"input": VALID}, headers=role("viewer")).status_code == 403
    assert client.get("/assessments", headers=role("viewer")).status_code == 200


def test_note_generation_verified_and_review_flow(client):
    a = client.post("/assessments", json={"input": VALID}).json()
    n = client.post(f"/assessments/{a['id']}/note")
    assert n.status_code == 200
    body = n.json()
    assert body["version"] == 2
    note = body["note"]
    assert note["verifier"]["flagged"] == [] and note["verifier"]["checked"] == note["verifier"]["passed"]
    assert [s["title"] for s in note["sections"]] == [
        "Primary Clinical Assessment", "Identified Risk Catalysts", "Cross-Disease Impact", "Recommended Next Steps"]
    stale = client.post(f"/assessments/{a['id']}/review", json={"version": 1})
    assert stale.status_code == 409
    ok = client.post(f"/assessments/{a['id']}/review", json={"version": 2})
    assert ok.status_code == 200 and ok.json()["note"]["reviewed_by"] == "dev@example.org"


def test_review_without_note_is_rejected(client):
    a = client.post("/assessments", json={"input": VALID}).json()
    assert client.post(f"/assessments/{a['id']}/review", json={"version": 1}).status_code == 404


def test_audit_admin_only_and_has_no_raw_inputs(client):
    a = client.post("/assessments", json={"input": VALID}).json()
    client.post(f"/assessments/{a['id']}/note")
    assert client.get("/audit").status_code == 403
    r = client.get("/audit", headers=role("admin"))
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 2 and entries[0]["verifier"] == "passed"
    assert all(len(e["input_hash"]) == 16 for e in entries)
    assert "148" not in r.text and "hba1c" not in r.text


def test_model_card_not_invented_for_placeholder(client):
    r = client.get("/model/card")
    assert r.status_code == 404 and "No evaluated model" in r.json()["detail"]


def test_rate_limit_returns_429_with_retry_after():
    c = make(rate_limit_per_min=3)
    codes = [c.get("/me").status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200] and codes[3] == 429
    assert "retry-after" in c.get("/me").headers


def test_iap_mode_requires_valid_token():
    settings = Settings(auth_mode="iap", iap_audience="aud", admin_emails=frozenset({"boss@x.org"}), clinician_emails=frozenset({"doc@x.org"}))

    def verifier(token: str, audience: str) -> dict:
        if token == "bad" or audience != "aud":
            raise ValueError("bad token")
        return {"email": token}

    c = TestClient(create_app(settings=settings, repo=InMemoryRepository(), model=PlaceholderModel(), jwt_verifier=verifier))
    assert c.get("/me").status_code == 401
    assert c.get("/me", headers={"x-goog-iap-jwt-assertion": "bad"}).status_code == 401
    assert c.get("/me", headers={"x-goog-iap-jwt-assertion": "boss@x.org"}).json()["role"] == "admin"
    assert c.get("/me", headers={"x-goog-iap-jwt-assertion": "doc@x.org"}).json()["role"] == "clinician"
    assert c.get("/me", headers={"x-goog-iap-jwt-assertion": "stranger@x.org"}).json()["role"] == "viewer"
    # the dev header must be ignored in iap mode
    assert c.get("/me", headers={"x-goog-iap-jwt-assertion": "stranger@x.org", "x-dev-role": "admin"}).json()["role"] == "viewer"
    assert c.get("/docs").status_code == 404


def test_iap_mode_needs_audience():
    with pytest.raises(ValueError):
        Settings(auth_mode="iap")


def test_auth_config_reports_mode(client):
    assert client.get("/auth/config").json() == {"mode": "dev"}
    iap = TestClient(create_app(settings=Settings(auth_mode="iap", iap_audience="aud"),
                                repo=InMemoryRepository(), model=PlaceholderModel(),
                                jwt_verifier=lambda t, a: {"email": t}))
    assert iap.get("/auth/config").json() == {"mode": "iap"}


def test_dev_login_sets_identity_via_cookie(client):
    r = client.post("/auth/dev-login", json={"name": "Dr. Rao", "role": "admin"})
    assert r.status_code == 200
    assert r.json() == {"email": "dev@example.org", "name": "Dr. Rao", "role": "admin"}
    assert client.get("/me").json() == {"email": "dev@example.org", "name": "Dr. Rao", "role": "admin"}
    assert client.get("/audit").status_code == 200  # now actually admin, not just via header


def test_dev_login_rejects_bad_role(client):
    assert client.post("/auth/dev-login", json={"name": "x", "role": "superuser"}).status_code == 422


def test_dev_login_blank_name_falls_back_to_default(client):
    client.post("/auth/dev-login", json={"name": "   ", "role": "viewer"})
    assert client.get("/me").json()["name"] == "Dev User"


def test_dev_login_unavailable_outside_dev_mode():
    c = TestClient(create_app(settings=Settings(auth_mode="iap", iap_audience="aud"),
                              repo=InMemoryRepository(), model=PlaceholderModel(),
                              jwt_verifier=lambda t, a: {"email": t}))
    assert c.post("/auth/dev-login", json={"name": "x", "role": "admin"}).status_code == 404


def test_dev_login_cookie_overrides_header(client):
    client.post("/auth/dev-login", json={"name": "Cookie User", "role": "viewer"})
    r = client.get("/me", headers={"X-Dev-Role": "admin"})  # cookie takes priority
    assert r.json()["role"] == "viewer"
