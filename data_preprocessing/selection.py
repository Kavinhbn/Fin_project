"""Feature selection (Boruta) and class balancing (SMOTE) for the multi-label NHANES data.

Both are applied on the TRAINING fold only, inside cross-validation / after the temporal
train/test split, never on the test set — fitting either on test data would leak information
and inflate reported accuracy.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from boruta import BorutaPy
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer

from common.config import SEED

log = logging.getLogger(__name__)


def boruta_select(X: pd.DataFrame, y: pd.Series, max_iter: int = 50) -> list[str]:
    """Return the columns Boruta confirms as relevant to `y` (missing values are median-imputed
    only for the purpose of running the selector; the caller's data is untouched)."""
    imputed = pd.DataFrame(SimpleImputer(strategy="median").fit_transform(X), columns=X.columns)
    rf = RandomForestClassifier(n_estimators=200, max_depth=6, n_jobs=-1, random_state=SEED)
    selector = BorutaPy(rf, n_estimators="auto", max_iter=max_iter, random_state=SEED, verbose=0)
    selector.fit(imputed.to_numpy(), y.to_numpy())
    kept = [c for c, keep in zip(X.columns, selector.support_, strict=True) if keep]
    if not kept:  # Boruta rejected everything (can happen with few, correlated features): keep all
        log.warning("Boruta confirmed no features for this target; keeping the full feature set")
        return list(X.columns)
    return kept


def smote_balance(X: pd.DataFrame, y: pd.Series, k_neighbors: int = 5) -> tuple[pd.DataFrame, pd.Series]:
    """Oversample the minority class. NaNs are median-imputed first: SMOTE cannot interpolate
    between missing values, and XGBoost's native NaN handling would otherwise be defeated by
    synthetic rows that are partly fabricated numbers, partly real gaps."""
    imputed = pd.DataFrame(SimpleImputer(strategy="median").fit_transform(X), columns=X.columns, index=X.index)
    minority = int(y.value_counts().min())
    k = max(1, min(k_neighbors, minority - 1))
    Xb, yb = SMOTE(random_state=SEED, k_neighbors=k).fit_resample(imputed, y)
    return pd.DataFrame(Xb, columns=X.columns), pd.Series(np.asarray(yb), name=y.name)
