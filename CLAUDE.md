# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
"Machine Learning-Based Prediction of Diabetes, Hypertension and Cardiovascular Comorbidities Using Clinical and Demographic Data" — an explainable multi-disease risk platform (product working name "Triad"). Full plan and status table: `PROJECT_PLAN.md`. UI rules: `frontend/DESIGN_PATTERNS.md`. Windows 11; Python via `py`/`.venv`, Node 23.

## Commands
Backend (from repo root, Windows paths):
- Tests: `.venv\Scripts\python -m pytest` · single test: `.venv\Scripts\python -m pytest tests/test_api.py::test_rate_limit_returns_429_with_retry_after`
- Lint / types / security: `.venv\Scripts\python -m ruff check .` · `-m mypy api common llm models data_preprocessing` · `-m bandit -r api common llm models data_preprocessing`
- Run API (dev auth, in-memory store, docs at /docs): `.venv\Scripts\python -m uvicorn api.main:app --reload --port 8000`
- Install: `py -m venv .venv` then `pip install -r requirements-dev.txt`

Frontend (`cd frontend`):
- `npm run dev` (mock API by default) · `npm run build` (tsc strict + vite) · `npx playwright test` (mock UI, 11 tests incl. axe) · `npx playwright test -c playwright.live.config.ts` (real backend + UI, starts both servers)
- Live mode: `VITE_API_MODE=live VITE_API_URL=http://localhost:8000` (backend must allow the UI origin via `CORS_ORIGINS`).

ML pipeline (real NHANES data, gitignored under `data/`; models under `models/artifacts/`; results under `reports/`):
- `.venv\Scripts\python scripts/download_nhanes.py` (CDC public files, 84 .xpt) → `-m models.train --trials 20 --boot 500` (tunes with Optuna, compares 5 models × 2 modes on held-out cycle J 2017-18, writes `reports/metrics.json`) → `-m models.package` (fits final cascades, conformal sets, model cards, `models/artifacts/<mode>/bundle.joblib`).
- `TrainedRiskModel.load()` is used by the API automatically when both bundles exist; otherwise the placeholder model. Loading warms up SHAP (~15 s, one-off).

## Architecture
- `common/` — `config.py` (seed, clinical ranges, DISCLAIMER) and `schemas.py` (all Pydantic domain types; mirrored by hand in `frontend/src/api/types.ts`; ranges also copied to `frontend/src/api/ranges.ts` — keep in sync).
- `data_preprocessing/` — NHANES label definitions (`labels.py`), leakage-safe feature sets (`features.py`), input validation. NHANES column names are from memory: verify against CDC codebooks.
- `models/` — `base.py` (`RiskModel` protocol the API depends on), `placeholder.py` (NOT trained, heuristic; flagged `is_placeholder`). The real XGBoost classifier-chain must implement `RiskModel`.
- `llm/note.py` — writer produces structured `Claim`s → `verify()` checks each against the model output (exact) AND, for the two mediator driver claims and the cross-disease pathway claims, against `knowledge_graph/` (guideline direction/presence) → only verified claims are rendered; dosing/treatment language is blocked; disclaimer is added by code. Raw clinical-feature driver claims (BMI, Age, ...) are deliberately NOT checked against the knowledge graph — see the comment above `MEDIATOR_ENTITY`. `TemplateWriter` is a stand-in for an LLM writer (same `NoteWriter` protocol). Knowledge-graph calls fail open (missing/broken bundle never blocks a note).
- `knowledge_graph/` — OKF-format bundle (`okf_bundle/`, 18 notes) + `okf.py` loader + `graph.py` (NetworkX, `supports_claim`/`evidence_for`). Every note is `status: needs_clinician_review`; some thresholds are CDC/NHLBI-sourced only because the ADA/ACC-AHA pages returned 403 when fetched.
- `data_preprocessing/selection.py` — Boruta feature selection + SMOTE balancing, used by the `xgboost_boruta_smote` comparison model in `models/train.py` (strict mode only; fit on the training partition only, never leaks into test/OOF).
- NHANES feature set includes socioeconomic/lifestyle fields (`RIDRETH1`, `EDUCATION`, `INCOME_RATIO`, `VIGOROUS_ACTIVITY`, `ALCOHOL_12PLUS`) — PAQ605/ALQ101 are absent in some cycles (2005-06 / 2017-18 respectively) by NHANES questionnaire design, not a bug; becomes NaN there, handled natively. `PatientInput` exposes these as optional fields end-to-end (schema → `models/trained.py::patient_row` → React form's "Optional: socioeconomic and lifestyle" section) so live predictions benefit too, not just the offline comparison.
- `api/` — `main.py` (`create_app` factory, everything injectable), `auth.py` (dev header vs Google IAP JWT; unknown emails = `viewer`), `service.py` (create/note/review use cases, version-guarded), `store.py` (Repository protocol + in-memory; Firestore impl pending), `ratelimit.py`, `settings.py` (env-driven; `AUTH_MODE=iap` requires `IAP_AUDIENCE`).
- `frontend/` — React 19 + Vite + Tailwind 4; `src/api/client.ts` picks mock vs live; UI never decides clinical levels.

## Rules that must hold
- Label leakage: exclude label-defining features per head (glucose/HbA1c for Diabetes, BP for Hypertension) in strict mode; report both modes.
- Fix random seeds (numpy, sklearn, xgboost).
- Every generated note carries the physician-sign-off disclaimer; `/model/card` must never return invented metrics (404 until an evaluated model is registered).
- Mock/placeholder outputs must stay labelled as such in the UI.
- `@tanstack/react-table` stays on v8; no localStorage in the UI; role gating is enforced on the server.
- Novelty to preserve (do not reduce to plain models + SHAP): classifier chain on a clinical DAG, direct-vs-mediated SHAP, SHAP-grounded note verifier, conformal sets with abstention.

- Honest findings to respect in any writing: the cascade does NOT beat independent XGBoost on accuracy — mediating probabilities are functions of the same inputs. The contribution is explanation (direct vs mediated), verified notes and conformal abstention, not accuracy. Full-mode Diabetes AUROC ~0.96 vs strict ~0.81 shows the label-leakage effect. Boruta+SMOTE did NOT beat plain XGBoost. **What DID raise accuracy** (2026-09-27): adding race/ethnicity, education, income-to-poverty ratio, physical activity and alcohol use as features — strict-mode macro AUROC went 0.816→0.825. CatBoost and a logistic-regression stacking ensemble were added too; stacking is marginally the best model (0.8249 strict / 0.9003 full) but not meaningfully different from plain XGBoost. PICO's O (beat Linear Regression / Random Forest) is satisfied with a wider margin now: XGBoost/stacking 0.825 (strict) / 0.900 (full) vs LR 0.809/0.881, RF 0.818/0.897. Current full comparison table lives in PROJECT_PLAN.md's PICO section — always re-check `reports/metrics.json` before citing a number in the paper, since it gets overwritten on every retrain.

## Status
Done: scaffolding, validators, labels/features, NHANES download+merge (39,492 adults), baselines + cascade + Boruta/SMOTE + Optuna, evaluation with bootstrap CIs, conformal sets, probability-scale SHAP + direct/mediated split, note verifier wired to the OKF knowledge graph, backend API (trained model wired in), React UI (mock + live), 60 pytest + 13 mock e2e + 1 live e2e. Not done: LLM writer (MedGemma/Gemini) — `TemplateWriter` stands in; explanation-stability/transportability study across cycles; Firestore store; GCP/Terraform/CI (user will do GCP/GitHub later); paper/report; verify the 4 originally-cited papers' DOIs/PMIDs; LIME (spec mentions SHAP+LIME, only SHAP is implemented — flag to user before claiming both). See `PROJECT_PLAN.md`.
