# Project Plan — ML-Based Prediction of Diabetes, Hypertension and Cardiovascular Comorbidities

## PICO check (updated 2026-09-27, after adding socioeconomic/lifestyle features + more baselines)
P: NHANES adults, routine checkup data. I: XGBoost MultiOutput/cascade + SHAP. C: Linear/Logistic Regression, Random Forest. O: higher accuracy than C.
Satisfied on real held-out data (`reports/metrics.json`, cycle 2017-18, n=5,525), strict mode (leakage-free) macro AUROC:

| Model | Strict | Full |
|---|---|---|
| Logistic Regression (C) | 0.809 | 0.881 |
| Random Forest (C) | 0.818 | 0.897 |
| LightGBM | 0.822 | 0.899 |
| CatBoost | 0.824 | 0.899 |
| XGBoost independent | 0.825 | **0.900** |
| XGBoost cascade (I) | 0.824 | 0.900 |
| XGBoost + Boruta + SMOTE | 0.819 (strict only; did not beat plain XGBoost) | — |
| **Stacking ensemble (best)** | **0.825** | **0.900** |

XGBoost beats both comparison baselines by a wider, more defensible margin than the first pass (was 0.816 vs 0.805/0.810; now 0.825 vs 0.809/0.818) — the gain came from adding race/ethnicity, education, income-to-poverty ratio, physical activity and alcohol use as features (`data_preprocessing/nhanes.py`), not from a smarter algorithm. Report this honestly: the accuracy lever that worked was **more features**, not the cascade architecture or SMOTE/Boruta (both tested, neither beat plain XGBoost). The paper's real strength stays explainability + verification + abstention, not raw accuracy — 0.82-0.90 AUROC is good, not exceptional.


Living document. Update the Status table after each milestone. Facts marked (verify) come from web summaries, not official pages; confirm at cloud.google.com before relying on them.

## 1. Goal and novelty
Predict Diabetes, Hypertension and CVD together from clinical and demographic data, explain each prediction, and give the clinician a safe plain-English note.
Novelty (integrated contribution; each part alone is already published, e.g. CardioMeta arXiv 2607.15721 covers multi-task + calibration):
1. Classifier chain on a clinical disease graph (Diabetes, Hypertension -> CVD).
2. SHAP split into direct vs. through-other-disease effect.
3. Narrative verifier that checks each sentence against the model's SHAP numbers.
4. Conformal prediction sets with "not sure" abstention.
5. NHANES -> MIMIC-IV explanation-stability study (stretch).

## 2. Principle: GCP-native from day one (no migration later)
- One GCP project, region **us-central1** (Cloud Run Always Free applies only in us-central1/us-east1/us-west1 — [source](https://cloudchipr.com/blog/cloud-run-pricing), verify). Data is public NHANES, so no residency issue.
- Every real resource (data, models, DB, API, UI, secrets, logs) lives on GCP from phase 0. The laptop is only the editor and test runner (VS Code + `gcloud` login). Docker on the laptop is optional: images are built by Cloud Build, so **no docker-compose**.
- A "walking skeleton" (hello-world API + UI deployed through the real CI/CD pipeline) is the first milestone, so deployment is never a last-minute surprise.
- All infrastructure is code (Terraform), so the whole environment can be rebuilt or torn down with one command.
- Config comes from environment variables and Secret Manager; the same code runs in dev and prod.

## 3. Architecture on GCP
```
GitHub --(push/tag)--> GitHub Actions (lint, types, tests, scans) --> Cloud Build --> Artifact Registry
                                                                                 |
                                                                                 v
User --HTTPS--> Cloud Run: ui (Streamlit) --> Cloud Run: api (FastAPI) --> Firestore (users, predictions, note cache, TTL 30d)
      (Google login / IAP)                            |--> Cloud Storage (model artifact, versioned)
                                                      |--> Secret Manager (API keys)
                                                      |--> LLM: Gemini API free tier (provider interface; Ollama/MedGemma = offline option)
                                                      |--> verifier + disclaimer --> response
Cloud Run Job (train) <-- Cloud Scheduler / manual --> Cloud Storage (raw, processed, models) + BigQuery (NHANES tables, experiment metrics, analytics)
Cloud Logging / Monitoring / Error Reporting + Budget alerts  (all services)
```
Only the XGBoost cascade produces predictions. The LLM only writes text from structured facts.

## 4. Service map (what runs where, cost posture)
| Need | GCP service | Free / cost note (verify) |
|---|---|---|
| Frontend | Cloud Run `ui` (Streamlit) | Always Free 2M requests, 180k vCPU-s, 360k GiB-s per month in free regions; set min-instances 0, max-instances 1 |
| Backend | Cloud Run `api` (FastAPI + Pydantic) | same free tier; private-by-default, called by ui with service identity |
| App DB | Firestore (Native) | Always Free 1 GB, 50k reads / 20k writes / 20k deletes per day ([source](https://aatayyab.wordpress.com/2026/06/26/google-cloud-free-tier-services-and-limits/)); TTL policy for retention |
| Analytics / audit warehouse | BigQuery | Always Free 1 TB queries + 10 GB storage; batch-load only (streaming inserts are billed) |
| Files: raw data, features, models | Cloud Storage (versioning on) | Always Free 5 GB in US regions |
| Cache | Firestore doc keyed by hash(inputs + model version) with TTL, plus in-process LRU | Memorystore/Redis is NOT free: avoided on purpose |
| Training | Cloud Run Jobs (containerised pipeline) | jobs free tier 240k vCPU-s + 450k GiB-s per month; Vertex AI custom training (~$0.22/h n1-standard-4, [source](https://www.nops.io/blog/vertex-ai-pricing/)) is the paid fallback |
| Experiment tracking / registry | BigQuery `experiments` table + versioned model manifest in GCS; Vertex AI Experiments/Model Registry as optional upgrade | keeps cost at zero |
| Scheduling | Cloud Scheduler (retrain / data refresh) | small free quota (verify) |
| Container images | Artifact Registry | 0.5 GB free — keep images small, delete old tags |
| Build | Cloud Build | 120 build-minutes/day free |
| Secrets | Secret Manager | 6 active secret versions, 10k accesses/month free |
| Auth | Google login via **direct IAP-on-Cloud-Run** (no Load Balancer — that old pattern was the actual cost driver; direct integration shipped Mar 2026, confirmed free, [docs](https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run)). Firebase Auth (50k MAU free) as a simpler fallback | confirmed free 2026-09-27 |
| LLM | Gemini API free tier (Flash models, ~10-15 req/min, [limits](https://ai.google.dev/gemini-api/docs/rate-limits)); Vertex AI Gemini if a keyless, IAM-only setup is required (billed, pennies) | MedGemma on Vertex needs a paid GPU endpoint — not used |
| Observability | Cloud Logging, Monitoring, Error Reporting | free allotments cover this scale |
| IaC | Terraform, state in a GCS bucket | free |
| CI | GitHub Actions (checks) + Workload Identity Federation (no JSON keys) | verify free minutes for private repos |

Langflow: run on the laptop (pip/uv, not Docker) to prototype the note-writing flow and for demos; the final flow is rewritten in plain Python inside `api/llm` so it can be tested and verified. Never expose Langflow publicly.

## 5. Cost and account guardrails (do BEFORE creating resources)
- A billing account with a card is required. Official docs ([Free Cloud features](https://docs.cloud.google.com/free/docs/free-cloud-features), read 2026-09-26): $300 welcome credit valid 90 days, new users only (never a paying GCP/Maps/Firebase customer, no previous trial), no automatic charge when it ends. NOT covered by the credit: Gemini API in AI Studio, partner models. Trial limits: no GPUs, no quota increases. A blog claimed accounts opened after 2 Mar 2026 lose the credit; the official page shows no such rule, but the signup screen is the final proof.
- The credit expires after 90 days, but the project runs longer: after that, either upgrade to a paid account (Always Free limits continue, real spend is expected to stay near $0-5/month) or shut resources down. Plan the demo/viva date inside the 90 days when possible, and start the trial when phase 0 begins, not earlier.
- Research credits ($5,000) are for faculty/PhD — ask the mentor if the college qualifies.
- Budget alerts at 50/90/100% of about $5 (alerts do not cap spend), plus: Cloud Run max-instances 1, per-API quotas lowered, no GPUs, no Cloud SQL, no Memorystore, no always-on Vertex endpoints.
- Weekly habit: check Billing > Reports; `terraform destroy` for anything unused after the demo.

## 6. Engineering stack
Python 3.11 (`py`), pandas, scikit-learn, xgboost, lightgbm, imbalanced-learn, optuna, shap, conformal library (MAPIE or crepes, decide in phase 7), networkx, FastAPI, Pydantic v2, Streamlit, google-cloud-{storage,firestore,bigquery,secret-manager}, pytest, ruff, mypy, pip-audit, bandit, Trivy (image scan in CI; Artifact Analysis scanning is billed, verify), Terraform.

Repository layout: `data_preprocessing/ models/ explainability/ knowledge_graph/ api/ ui/ llm/ infra/ (terraform) tests/ docs/ notebooks/ .github/workflows/` + `pyproject.toml`, `requirements*.txt`, `.env.example`, `README.md`, `CLAUDE.md`, `PROJECT_PLAN.md`.

Knowledge layer: OKF bundle (markdown + YAML) of guideline facts with source links, loaded into NetworkX; stored in GCS and baked into the api image.

## 7. Security and safety checklist
- **Data:** public de-identified NHANES only; app stores no names/IDs; user-entered values kept only with opt-in, Firestore TTL 30 days; no real patient data anywhere; no HIPAA/DPDP compliance claim (student project).
- **Identity:** login required for ui; api private (IAM invoker = ui service account); roles clinician/admin.
- **Least privilege:** one service account per service with only the roles it needs; no owner/editor roles on runtime accounts; no downloaded JSON keys anywhere (WIF for CI).
- **Secrets:** Secret Manager; `.env` local only and gitignored.
- **Transport/abuse:** HTTPS by default on Cloud Run; CORS allow-list; app-level rate limiting; request size/timeouts; max-instances cap. (Cloud Armor is paid — skipped.)
- **Input:** Pydantic range/type validation, 422 with clear messages for NaN/out-of-range values.
- **LLM-specific:** prompt built only from structured facts (no user free text) to block prompt injection; temperature 0; output passes the verifier; disclaimer appended by code; no dosing/treatment orders, only "for physician review" suggestions. Free-tier Gemini data may be used by Google for improvement (verify) — acceptable only because no PHI is sent.
- **Supply chain:** pinned deps, pip-audit, bandit, Trivy, minimal non-root images.
- **Audit:** each prediction logs timestamp, model version, input hash, verifier verdict (Firestore + periodic batch load to BigQuery).
- **Fairness/robustness:** subgroup metrics (sex, age band, race/ethnicity), calibration plots, failure-case report.

## 8. Phases (must-have first)
| # | Deliverable | Tier | Status |
|---|---|---|---|
| 0-local | Local scaffolding: venv, requirements, pyproject, package layout, config, validators, API schemas, label/feature modules + 12 tests (done 2026-09-26; no GCP/GitHub needed) | must | done |
| 0-ui | React UI (frontend/): tokens, shell, primitives, 4 screens on mock API, DESIGN_PATTERNS.md, 11 Playwright tests + axe pass (done 2026-09-26; backend endpoints `/me /disclaimer /assessments /assessments/{id} /assessments/{id}/note /assessments/{id}/review /model/card /audit` still to build in api/) | must | done (mock) |
| 0-api | FastAPI backend (api/, models/base+placeholder, llm/note verifier): all UI endpoints, IAP/dev auth, roles, rate limit, security headers, version-guarded review, audit; 31 pytest + ruff + mypy + bandit clean; live UI<->API smoke test passes (done 2026-09-27). Placeholder model only; Firestore store + real IAP verification untested until GCP exists | must | done (placeholder model) |
| 1 | NHANES download (84 files, 2005-2018) + merge + labels + leakage-safe features: 39,492 adults; prevalence DM 17.4%, HTN 42.1%, CVD 11.3% (done 2026-09-27) | must | done |
| 2 | Baselines (LR, RF, LightGBM, XGBoost) + cascade + Optuna; test = cycle J 2017-18 (5,525 rows); bootstrap CIs. Strict macro AUROC: cascade 0.8156 [0.807,0.824] vs indep. XGB 0.8154 vs LR 0.805. Full mode 0.896 (DM 0.96 = leakage) | must | done |
| 3 | Probability-scale Shapley explanations per disease + direct/mediated CVD split (explainability/mediation.py) | must | done |
| 5 | Direct/mediated split; shares e.g. direct 78% / via DM 13% / via HTN 10% for a sample patient | novelty | done (needs validation study) |
| 6 | Note verifier (structured claims, exact check vs model output, dosing filter) | novelty | done (template writer; LLM writer pending) |
| 7 | Conformal sets (alpha 0.1): test coverage DM 0.895, HTN 0.910, CVD 0.877; joint 0.741 (>= 0.70 Bonferroni); uncertain rate 35-44% | novelty | done |
| 8 | OKF bundle: 18 notes, loader, graph, 9 tests; ADA/ACC-AHA pages unreachable (403) so some thresholds only CDC/NHLBI-sourced; all notes `needs_clinician_review`. Wired into the note verifier: mediator driver claims (Diabetes/Hypertension (predicted) -> CVD) are checked against the graph's documented direction, and pathway claims require the graph to support the relationship. Raw clinical features (BMI, Age, ...) are deliberately NOT checked directionally — empirically their per-patient SHAP sign legitimately disagrees with the population-level relationship due to feature correlation (see comment above `MEDIATOR_ENTITY` in `llm/note.py`). Fails open if the bundle breaks | novelty | done |
| 1b | Boruta feature selection + SMOTE balancing (`data_preprocessing/selection.py`), added as an extra comparison model `xgboost_boruta_smote` in strict mode | spec (Phase 1) | done — did not beat plain XGBoost; reported honestly, not hidden |
| 1c | Expanded feature set: race/ethnicity, education, income-to-poverty ratio, vigorous physical activity, alcohol use (new NHANES components PAQ/ALQ + DEMO fields; `nhanes.py` recode(), `features.py`). Genuinely raised strict-mode macro AUROC 0.816→0.825. Also added CatBoost and a logistic-regression stacking ensemble (`stack_ensemble` in `train.py`) as further comparisons — stacking is now (marginally) the best model | accuracy | done |
| 1d | Live product extended to match: `PatientInput` gained 5 optional fields (`common/schemas.py`), mapped through `models/trained.py`, exposed in the React form as an "Optional: socioeconomic and lifestyle" section (`AssessScreen.tsx`) — so real users, not just the offline research comparison, benefit from the accuracy gain | product | done |
| 0a | GCP project, billing alerts, Terraform base (APIs, buckets, service accounts, Artifact Registry) | must | todo |
| 0b | Walking skeleton: hello api + ui deployed via CI/CD to Cloud Run | must | todo |
| 1 | NHANES download -> GCS raw; labels; leakage-safe features -> BigQuery/GCS | must | todo |
| 2 | Baselines + XGBoost + chain, Optuna, metrics with CIs (Cloud Run Job) | must | todo |
| 3 | TreeSHAP global/local per disease | must | todo |
| 4 | API `/predict /explain /note` + Streamlit UI + LLM note + disclaimer | must | todo |
| 5 | Direct/mediated SHAP | novelty | todo |
| 6 | Narrative verifier | novelty | todo |
| 7 | Conformal sets + abstention | novelty | todo |
| 8 | OKF knowledge bundle + GraphRAG | novelty | todo |
| 9 | Hardening: auth, monitoring, load test, cost review, model card | must | todo |
| 10 | MIMIC-IV transport study (needs PhysioNet credentialing) | stretch | todo |
| 11 | Paper + report + viva prep | must | todo |

Passing bar: 0-4, 9, 11 plus at least phase 5 or 6.

## 9. Engineering workflow
- `main` protected; feature branches; small commits (git init pending); PRs even when solo.
- Per-phase done = code + type hints + docstrings + tests + metrics row in BigQuery `experiments` + this table updated + memory log updated.
- Seeds fixed (numpy, sklearn, xgboost); versions pinned; data hash recorded per run.
- Tests: unit (validators, features, chain order), API integration (test client + Firestore emulator), metric-floor regression test, verifier tests (known-bad sentences must be blocked).
- Docs: README, `docs/architecture.md`, `docs/model_card.md` (intended use, limits, metrics, ethics), runbook (deploy, rollback, teardown).
- Release: tag -> build -> deploy to `api-dev`; manual promote to `api-prod`; rollback = redeploy previous revision.

## 10. Decisions (user, 2026-09-26)
1. GitHub repo: **private**.
2. College stack/report format: **no requirement**.
3. Frontend: **React** (replaces Streamlit; see change below).
4. Auth: **Google login via IAP**.
5. Budget: stay within the $300 trial credit; card availability still to confirm at signup.

Change from React: `ui` = React (Vite + TypeScript + Tailwind) built to static files and served from Cloud Run (nginx container) or Firebase Hosting (free tier, verify); it calls the FastAPI `api`. Charts: Recharts or Plotly.js for SHAP waterfall/bar. IAP protects the service (verify IAP-on-Cloud-Run setup: needs OAuth consent screen + allow-listed Google accounts; add mentor/examiner emails for the demo). Streamlit remains only as a throwaway internal prototype tool if useful. React adds work: budget extra time in phase 4 and keep the UI to 4 screens (input form, risk dashboard, explanation, note).

## 11. Budget estimate (rough; verify with the Pricing Calculator)
Expected cost inside Always Free limits: about $0. Worst realistic case (Cloud Run above free tier, Cloud Build overage, small Vertex training run, Gemini via Vertex): a few dollars. The $300 credit covers this many times over; the only real risk is forgetting a paid resource (GPU endpoint, Cloud SQL) running for weeks. Guardrails in section 5 address that.
