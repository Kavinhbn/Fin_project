# Triad — Explainable Multi-Disease Risk Platform

Predicts diabetes, hypertension and cardiovascular disease (CVD) together from routine
checkup data, explains every prediction, and generates a clinician-reviewable note whose
claims are checked against the model's own numbers before they're shown.

Trained on real NHANES 2005–2018 data (39,492 US adults). Research prototype — **not
validated for clinical use.**

## Why "together"?

Most risk tools treat each disease in isolation. Here, the diabetes and hypertension
predictions feed into the CVD model as extra inputs (a classifier chain), and each CVD
estimate is decomposed into how much comes directly from the patient's own numbers versus
how much is mediated through the other two conditions.

## What's in here

| | |
|---|---|
| **Prediction** | XGBoost classifier chain, tuned with Optuna, compared against Logistic Regression / Random Forest / LightGBM / CatBoost / a stacking ensemble, and a Boruta+SMOTE variant — all evaluated on data the model never trained on |
| **Explainability** | TreeSHAP-based per-disease drivers, split into direct vs. comorbidity-mediated effects |
| **Uncertainty** | Conformal prediction — the model can say "uncertain" instead of forcing a confident answer it can't back up |
| **Clinical notes** | Structured claims checked against the model's SHAP output and an OKF-format medical knowledge graph before rendering; unverified claims are dropped, not shown |
| **Frontend** | React clinician dashboard — assess a patient, review explanations, generate/review a note, browse the model's own evaluation results |

Full architecture, honest accuracy numbers, and the PICO framing are in
[PROJECT_PLAN.md](PROJECT_PLAN.md). Guidance for anyone (human or AI) working on this code
is in [CLAUDE.md](CLAUDE.md).

## Running it

**Backend**
```powershell
py -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt
.venv\Scripts\python -m uvicorn api.main:app --reload --port 8000
```
Runs against a placeholder heuristic model until you've trained one (see below); API docs at
`/docs`.

**Frontend**
```powershell
cd frontend
npm install
npm run dev
```
Defaults to in-memory demo data (`VITE_API_MODE=mock`). Set `VITE_API_MODE=live` and
`VITE_API_URL=http://localhost:8000` in a `.env.local` to talk to the real backend.

**Training the real model** (needs NHANES data — see `scripts/download_nhanes.py`)
```powershell
.venv\Scripts\python scripts\download_nhanes.py
.venv\Scripts\python -m models.train --trials 20 --boot 500
.venv\Scripts\python -m models.package
```
The API automatically picks up `models/artifacts/` once it exists.

**Tests**
```powershell
.venv\Scripts\python -m pytest              # backend
cd frontend && npx playwright test          # frontend (mock)
```

## Status

Working end-to-end: data pipeline, trained model, SHAP explanations, conformal sets, note
verifier + knowledge graph, API, UI. Not yet done: LLM-generated notes (currently
template-based), cloud deployment, MIMIC-IV transportability study. See PROJECT_PLAN.md for
the full status table.
