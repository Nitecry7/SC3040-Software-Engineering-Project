"""Sparse one-hot Linear and Ridge regression pipelines for HDB prices."""

from dataclasses import dataclass
import math
from typing import Literal

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics

CATEGORICAL_FEATURES = (
    "town",
    "flat_type",
    "block",
    "street_name",
    "flat_model",
)
NUMERIC_FEATURES = (
    "transaction_year",
    "transaction_month",
    "floor_area_sqm",
    "storey_mid",
    "remaining_lease_months",
)
MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
RIDGE_ALPHAS = (0.1, 1.0, 10.0, 100.0)


@dataclass(frozen=True)
class ModelCandidate:
    """One validation-only candidate and its validation predictions."""

    model_name: Literal["linear", "ridge"]
    alpha: float | None
    metrics: RegressionMetrics
    predictions: pd.Series
    pipeline: Pipeline | None = None


def select_model_features(features: pd.DataFrame) -> pd.DataFrame:
    """Select the fixed base feature schema and reject target leakage explicitly."""
    if "resale_price" in features.columns:
        raise ValueError("Model features must not contain resale_price")
    missing = [column for column in MODEL_FEATURES if column not in features.columns]
    if missing:
        raise ValueError(f"Model features are missing required columns: {', '.join(missing)}")
    return features.loc[:, MODEL_FEATURES].copy()


def _preprocessor() -> ColumnTransformer:
    categorical = OneHotEncoder(
        drop="first",
        handle_unknown="ignore",
        sparse_output=True,
        dtype=np.float64,
    )
    return ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), list(NUMERIC_FEATURES)),
            ("categorical", categorical, list(CATEGORICAL_FEATURES)),
        ],
        remainder="drop",
        sparse_threshold=1.0,
        verbose_feature_names_out=True,
    )


def build_linear_pipeline() -> Pipeline:
    """Build ordinary least squares with train-fitted numeric and category transforms."""
    return Pipeline(
        steps=[
            ("preprocessor", _preprocessor()),
            ("regressor", LinearRegression()),
        ]
    )


def build_ridge_pipeline(alpha: float) -> Pipeline:
    """Build Ridge with an explicit alpha and sparse-compatible LSQR solver."""
    if not math.isfinite(alpha) or alpha <= 0:
        raise ValueError("Ridge alpha must be positive")
    return Pipeline(
        steps=[
            ("preprocessor", _preprocessor()),
            ("regressor", Ridge(alpha=alpha, solver="lsqr")),
        ]
    )


def build_candidate_pipeline(candidate: ModelCandidate) -> Pipeline:
    if candidate.model_name == "linear":
        if candidate.alpha is not None:
            raise ValueError("Linear Regression does not accept an alpha")
        return build_linear_pipeline()
    if candidate.alpha is None:
        raise ValueError("Ridge candidates require an alpha")
    return build_ridge_pipeline(candidate.alpha)


def _validate_aligned_rows(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_validation: pd.DataFrame,
    y_validation: pd.Series,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if not X_train.index.equals(y_train.index):
        raise ValueError("Training features and target must have identical indices")
    if not X_validation.index.equals(y_validation.index):
        raise ValueError("Validation features and target must have identical indices")
    if X_train.empty or X_validation.empty:
        raise ValueError("Training and validation partitions must both contain rows")
    return select_model_features(X_train), select_model_features(X_validation)


def evaluate_validation_candidates(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_validation: pd.DataFrame,
    y_validation: pd.Series,
    alphas: tuple[float, ...] = RIDGE_ALPHAS,
) -> list[ModelCandidate]:
    """Fit candidates on train only and score each against validation only."""
    train_features, validation_features = _validate_aligned_rows(
        X_train, y_train, X_validation, y_validation
    )
    configurations: list[tuple[Literal["linear", "ridge"], float | None]] = [
        ("linear", None),
        *[("ridge", alpha) for alpha in alphas],
    ]
    results = []
    for model_name, alpha in configurations:
        pipeline = (
            build_linear_pipeline()
            if model_name == "linear"
            else build_ridge_pipeline(alpha)
        )
        pipeline.fit(train_features, y_train)
        predictions = pd.Series(
            pipeline.predict(validation_features),
            index=y_validation.index,
            name="prediction",
        )
        results.append(
            ModelCandidate(
                model_name=model_name,
                alpha=alpha,
                metrics=calculate_regression_metrics(y_validation, predictions),
                predictions=predictions,
                pipeline=pipeline,
            )
        )
    return results


def fit_selected_model(
    candidate: ModelCandidate,
    X_training: pd.DataFrame,
    y_training: pd.Series,
) -> Pipeline:
    """Fit a frozen validation-selected configuration on its supplied history only."""
    if not X_training.index.equals(y_training.index):
        raise ValueError("Training features and target must have identical indices")
    if X_training.empty:
        raise ValueError("Training data must contain at least one row")
    pipeline = build_candidate_pipeline(candidate)
    pipeline.fit(select_model_features(X_training), y_training)
    return pipeline


def _candidate_tie_key(candidate: ModelCandidate) -> tuple[float, float, int, float]:
    return (
        candidate.metrics.rmse_sgd,
        candidate.metrics.median_absolute_error_sgd,
        0 if candidate.model_name == "linear" else 1,
        candidate.alpha if candidate.alpha is not None else 0.0,
    )


def select_validation_candidate(candidates: list[ModelCandidate]) -> ModelCandidate:
    """Choose from validation summaries only, with the agreed 1% MAE tie band."""
    if not candidates:
        raise ValueError("At least one validation candidate is required")
    best_mae = min(candidate.metrics.mae_sgd for candidate in candidates)
    threshold = best_mae if best_mae == 0 else best_mae * 1.01
    tied = [candidate for candidate in candidates if candidate.metrics.mae_sgd <= threshold]
    return min(tied, key=_candidate_tie_key)
