"""Class-conditional split/cross-conformal prediction sets for each disease, with abstention.

For every disease and class c in {0, 1} the nonconformity score of a calibration example with
true class c is 1 - p(c). The threshold q_c is the ceil((n_c + 1)(1 - alpha)) / n_c empirical
quantile of those scores. A class enters a patient's prediction set when 1 - p(c) <= q_c.
  {1}   -> confident positive     {0}   -> confident negative
  {0,1} -> UNCERTAIN (abstain)    {}    -> atypical patient (model doubts both classes)
Per-label coverage of true classes is >= 1 - alpha under exchangeability. Joint coverage over
the three labels is >= 1 - 3*alpha (Bonferroni). Calibration scores come from the model's
out-of-fold predictions (cross-conformal), so no data is thrown away; coverage under a
temporal shift is measured empirically on the held-out cycle instead of assumed.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from common.config import TARGETS


class ConformalSets:
    def __init__(self, alpha: float = 0.1) -> None:
        if not 0 < alpha < 1:
            raise ValueError("alpha must be in (0, 1)")
        self.alpha = alpha
        self.q_: dict[str, dict[int, float]] = {}

    def fit(self, P: pd.DataFrame, Y: pd.DataFrame) -> ConformalSets:
        """Calibrate on out-of-fold probabilities `P` and true labels `Y`."""
        for t in TARGETS:
            p, y = P[t].to_numpy(), Y[t].to_numpy().astype(int)
            self.q_[t] = {}
            for c in (0, 1):
                # nonconformity = 1 - p(true class); p(1)=p, p(0)=1-p
                scores = (1 - p[y == 1]) if c == 1 else p[y == 0]
                n = len(scores)
                if n == 0:
                    raise ValueError(f"no calibration examples for {t} class {c}")
                rank = min(n, math.ceil((n + 1) * (1 - self.alpha)))
                self.q_[t][c] = float(np.sort(scores)[rank - 1])
        return self

    def sets(self, P: pd.DataFrame) -> dict[str, np.ndarray]:
        """Boolean array per disease with shape (n, 2): membership of class 0 and class 1."""
        if not self.q_:
            raise RuntimeError("ConformalSets is not fitted")
        out: dict[str, np.ndarray] = {}
        for t in TARGETS:
            p1 = P[t].to_numpy()
            in0 = p1 <= self.q_[t][0]  # 1 - p(class 0) = p1
            in1 = (1 - p1) <= self.q_[t][1]
            out[t] = np.column_stack([in0, in1])
        return out

    def is_uncertain(self, P: pd.DataFrame) -> dict[str, np.ndarray]:
        s = self.sets(P)
        return {t: np.asarray(s[t].all(axis=1)) for t in TARGETS}

    def evaluate(self, P: pd.DataFrame, Y: pd.DataFrame) -> dict[str, object]:
        """Empirical coverage, set sizes and abstention rate on held-out data."""
        s = self.sets(P)
        covered = {}
        for t in TARGETS:
            y = Y[t].to_numpy().astype(int)
            covered[t] = s[t][np.arange(len(y)), y]
        joint = np.column_stack([covered[t] for t in TARGETS]).all(axis=1)
        return {
            "alpha": self.alpha,
            "target_per_label": 1 - self.alpha,
            "target_joint_bonferroni": max(0.0, 1 - len(TARGETS) * self.alpha),
            "coverage_per_label": {t: float(covered[t].mean()) for t in TARGETS},
            "coverage_joint": float(joint.mean()),
            "uncertain_rate": {t: float(s[t].all(axis=1).mean()) for t in TARGETS},
            "empty_rate": {t: float((~s[t].any(axis=1)).mean()) for t in TARGETS},
            "mean_set_size": {t: float(s[t].sum(axis=1).mean()) for t in TARGETS},
        }
