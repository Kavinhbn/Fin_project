"""Explanations for the cascade: TreeSHAP drivers per disease and a direct-vs-mediated split.

Direct vs mediated (model-based, NOT causal proof):
  total    : Shapley values of the full cascade P(CVD | x)
  direct   : Shapley values of P(CVD) with both mediators frozen at their reference value
  via_dm   : Shapley values of P(CVD) where only the diabetes mediator responds to x
  via_htn  : same for the hypertension mediator
Each function is explained with the same interventional background, so the pieces are
comparable. `residual = total - (direct + via_dm + via_htn)` is reported (interaction terms).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import shap

from common.config import SEED
from models.cascade import MEDIATORS, CascadeModel

FEATURE_LABEL: dict[str, str] = {
    "RIDAGEYR": "Age", "SEX_MALE": "Sex", "BMXBMI": "BMI", "LBXTC": "Total cholesterol",
    "LBDHDD": "HDL cholesterol", "LBDLDL": "LDL cholesterol", "LBXTR": "Triglycerides",
    "SMOKER": "Smoking", "LBXGH": "HbA1c", "LBXGLU": "Fasting glucose",
    "SBP_MEAN": "Systolic BP", "DBP_MEAN": "Diastolic BP",
    "RIDRETH1": "Race/ethnicity", "EDUCATION": "Education", "INCOME_RATIO": "Income-to-poverty ratio",
    "VIGOROUS_ACTIVITY": "Vigorous physical activity", "ALCOHOL_12PLUS": "Regular alcohol use",
    "p_diabetes": "Diabetes (predicted)", "p_hypertension": "Hypertension (predicted)",
}


@dataclass(frozen=True)
class Attribution:
    """Per-feature contributions (probability scale) for one patient's CVD estimate."""

    total: dict[str, float]
    direct: dict[str, float]
    via_diabetes: dict[str, float]
    via_hypertension: dict[str, float]

    def shares(self) -> dict[str, float]:
        """Normalised share of absolute attribution flowing directly / via each mediator."""
        parts = {
            "direct": sum(abs(v) for v in self.direct.values()),
            "via_diabetes": sum(abs(v) for v in self.via_diabetes.values()),
            "via_hypertension": sum(abs(v) for v in self.via_hypertension.values()),
        }
        total = sum(parts.values())
        if total == 0:
            return {"direct": 1.0, "via_diabetes": 0.0, "via_hypertension": 0.0}
        return {k: v / total for k, v in parts.items()}


def all_input_columns(model: CascadeModel) -> list[str]:
    """Raw feature columns the cascade reads (union over heads, stable order)."""
    seen: dict[str, None] = {}
    for cols in (model.columns_["diabetes"], model.columns_["hypertension"], model.columns_["cvd"]):
        for c in cols:
            seen.setdefault(c)
    return list(seen)


def _background(background: pd.DataFrame, cols: list[str], n: int = 100) -> pd.DataFrame:
    if len(background) > n:
        background = background.sample(n, random_state=SEED)
    return background[cols].reset_index(drop=True)


def cascade_attribution(model: CascadeModel, x: pd.DataFrame, background: pd.DataFrame, n_background: int = 100,
                        permutations: int = 10) -> Attribution:
    """Direct/mediated decomposition of the CVD estimate for the single-row frame `x`.

    Cost grows with `n_background * permutations`; fewer permutations give noisier (still seeded,
    deterministic) estimates."""
    cols = all_input_columns(model)
    bg = _background(background, cols, n_background)
    ref_feats = bg.median(numeric_only=True)
    ref_med = model.level1_proba(bg).mean()
    cvd_feats = model.columns_["cvd"]
    cvd_model, cvd_cal = model.cvd_model_, model.cvd_calibrator_
    if cvd_model is None or cvd_cal is None:
        raise RuntimeError("cascade is not fitted")

    def cvd_prob(feature_frame: pd.DataFrame, p_dm: np.ndarray, p_htn: np.ndarray) -> np.ndarray:
        frame = feature_frame[cvd_feats].copy()
        frame[MEDIATORS[0]], frame[MEDIATORS[1]] = p_dm, p_htn
        return np.asarray(cvd_cal.predict(cvd_model.predict_proba(frame)[:, 1]))

    def as_frame(arr: np.ndarray) -> pd.DataFrame:
        return pd.DataFrame(arr, columns=cols)

    def f_total(arr: np.ndarray) -> np.ndarray:
        return np.asarray(model.predict_proba(as_frame(arr))["cvd"])

    def f_direct(arr: np.ndarray) -> np.ndarray:
        df = as_frame(arr)
        n = len(df)
        return cvd_prob(df, np.full(n, ref_med[MEDIATORS[0]]), np.full(n, ref_med[MEDIATORS[1]]))

    def _only(which: str) -> object:
        def f(arr: np.ndarray) -> np.ndarray:
            df = as_frame(arr)
            n = len(df)
            fixed = pd.DataFrame(np.tile(ref_feats[cols].to_numpy(), (n, 1)), columns=cols)
            m = model.level1_proba(df)
            p_dm = m[MEDIATORS[0]].to_numpy() if which == "dm" else np.full(n, ref_med[MEDIATORS[0]])
            p_htn = m[MEDIATORS[1]].to_numpy() if which == "htn" else np.full(n, ref_med[MEDIATORS[1]])
            return cvd_prob(fixed, p_dm, p_htn)
        return f

    masker = shap.maskers.Independent(bg.to_numpy(), max_samples=len(bg))
    row = x[cols].to_numpy(dtype=float)

    def explain(fn: object) -> dict[str, float]:
        explainer = shap.PermutationExplainer(fn, masker, seed=SEED)
        vals = explainer(row, max_evals=2 * len(cols) * permutations + 1, batch_size=128, silent=True).values[0]
        return {c: float(v) for c, v in zip(cols, vals, strict=True)}

    return Attribution(total=explain(f_total), direct=explain(f_direct),
                       via_diabetes=explain(_only("dm")), via_hypertension=explain(_only("htn")))


def head_attributions(model: CascadeModel, x: pd.DataFrame, background: pd.DataFrame, n_background: int = 50,
                      permutations: int = 8) -> dict[str, dict[str, float]]:
    """Probability-scale Shapley values over the raw inputs for each disease's *total* estimate.

    Diabetes and hypertension are explained through their own heads; CVD through the whole cascade
    (so mediated effects are included). Using one scale and one background for all three keeps
    the explanations comparable and free of stacking artefacts (e.g. 'age lowers CVD given the
    hypertension score').
    """
    cols = all_input_columns(model)
    bg = _background(background, cols, n_background)
    masker = shap.maskers.Independent(bg.to_numpy(), max_samples=len(bg))
    row = x[cols].to_numpy(dtype=float)

    def head_fn(name: str) -> object:
        def f(arr: np.ndarray) -> np.ndarray:
            df = pd.DataFrame(arr, columns=cols)
            if name == "cvd":
                return np.asarray(model.predict_proba(df)["cvd"])
            return np.asarray(model.level1_proba(df)[MEDIATORS[0] if name == "diabetes" else MEDIATORS[1]])
        return f

    out: dict[str, dict[str, float]] = {}
    for name in ("diabetes", "hypertension", "cvd"):
        explainer = shap.PermutationExplainer(head_fn(name), masker, seed=SEED)
        vals = explainer(row, max_evals=2 * len(cols) * permutations + 1, batch_size=128, silent=True).values[0]
        out[name] = {c: float(v) for c, v in zip(cols, vals, strict=True)}
    return out


def tree_drivers(model: CascadeModel, x: pd.DataFrame, top: int = 3) -> dict[str, tuple[list[tuple[str, float]], list[tuple[str, float]]]]:
    """TreeSHAP (log-odds) top positive / negative drivers per head for the single-row frame `x`."""
    out: dict[str, tuple[list[tuple[str, float]], list[tuple[str, float]]]] = {}
    frames = {
        "diabetes": x[model.columns_["diabetes"]],
        "hypertension": x[model.columns_["hypertension"]],
        "cvd": model.cvd_frame(x),
    }
    estimators = {"diabetes": model.level1_["diabetes"], "hypertension": model.level1_["hypertension"], "cvd": model.cvd_model_}
    for head, frame in frames.items():
        est = estimators[head]
        values = shap.TreeExplainer(est).shap_values(frame)
        pairs = sorted(zip(frame.columns, np.asarray(values)[0], strict=True), key=lambda p: p[1], reverse=True)
        pos = [(c, float(v)) for c, v in pairs if v > 0][:top]
        neg = [(c, float(v)) for c, v in reversed(pairs) if v < 0][:top]
        out[head] = (pos, neg)
    return out
