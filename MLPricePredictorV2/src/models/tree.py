"""Leakage-safe tree regressors with model-specific categorical handling."""

from dataclasses import dataclass
import math
import pickle
from time import perf_counter
from typing import Literal

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics
from src.models.linear import (
    CATEGORICAL_FEATURES,
    MODEL_FEATURES,
    NUMERIC_FEATURES,
    select_model_features,
)

TreeFamily = Literal["extra_trees", "random_forest", "hist_gradient_boosting"]
HISTOGRAM_CATEGORICAL_FEATURES = ("town", "flat_type", "flat_model")
HISTOGRAM_FEATURES = NUMERIC_FEATURES + HISTOGRAM_CATEGORICAL_FEATURES
RANDOM_STATE = 42
TREE_CONFIGURATIONS = (
    ("extra_trees", 2, None),
    ("extra_trees", 10, None),
    ("random_forest", 2, None),
    ("random_forest", 10, None),
    ("hist_gradient_boosting", 20, 100),
    ("hist_gradient_boosting", 20, 200),
)


@dataclass(frozen=True)
class TreeModelConfig:
    family: TreeFamily
    min_samples_leaf: int
    max_iter: int | None = None

    @property
    def config_id(self) -> str:
        if self.family == "hist_gradient_boosting":
            return f"{self.family}-max_iter_{self.max_iter}"
        return f"{self.family}-min_samples_leaf_{self.min_samples_leaf}"

    @property
    def parameters(self) -> dict[str, int | float | str | bool]:
        if self.family in ("extra_trees", "random_forest"):
            return {
                "n_estimators": 100,
                "min_samples_leaf": self.min_samples_leaf,
                "max_features": 1.0,
                "random_state": RANDOM_STATE,
                "n_jobs": -1,
            }
        return {
            "max_iter": self.max_iter,
            "learning_rate": 0.1,
            "max_leaf_nodes": 31,
            "min_samples_leaf": self.min_samples_leaf,
            "l2_regularization": 1.0,
            "max_bins": 255,
            "categorical_features": "from_dtype",
            "early_stopping": False,
            "random_state": RANDOM_STATE,
        }


@dataclass(frozen=True)
class TreeValidationResult:
    config: TreeModelConfig
    metrics: RegressionMetrics
    predictions: pd.Series
    pipeline: Pipeline
    fit_seconds: float
    prediction_seconds: float
    matrix_shape: tuple[int, int]
    matrix_format: str
    matrix_memory_bytes: int
    model_memory_bytes: int = 0


def tree_configurations() -> tuple[TreeModelConfig, ...]:
    """Return the fixed six-configuration validation search."""
    return tuple(
        TreeModelConfig(family, min_samples_leaf, max_iter)
        for family, min_samples_leaf, max_iter in TREE_CONFIGURATIONS
    )


def select_tree_features(features: pd.DataFrame, family: TreeFamily) -> pd.DataFrame:
    """Select only permitted base features for the requested tree family."""
    if family not in ("extra_trees", "random_forest", "hist_gradient_boosting"):
        raise ValueError(f"Unsupported tree model family: {family}")
    if "resale_price" in features.columns:
        raise ValueError("Model features must not contain resale_price")
    if family == "hist_gradient_boosting":
        missing = [column for column in HISTOGRAM_FEATURES if column not in features.columns]
        if missing:
            raise ValueError(
                f"HistGradientBoosting features are missing required columns: {', '.join(missing)}"
            )
        return features.loc[:, HISTOGRAM_FEATURES].copy()
    return select_model_features(features).loc[:, MODEL_FEATURES].copy()


class TrainCategoryFramePreprocessor(BaseEstimator, TransformerMixin):
    """Apply categories learned from fit rows and map unseen values to missing."""

    def __init__(self, feature_columns=HISTOGRAM_FEATURES):
        self.feature_columns = feature_columns

    def fit(self, X: pd.DataFrame, y=None):
        if "resale_price" in X.columns:
            raise ValueError("Model features must not contain resale_price")
        if tuple(X.columns) != tuple(self.feature_columns):
            raise ValueError("HistGradientBoosting feature columns must match the fixed schema")
        self.feature_names_in_ = np.asarray(X.columns, dtype=object)
        self.categories_ = {
            column: tuple(sorted(X[column].dropna().unique().tolist()))
            for column in HISTOGRAM_CATEGORICAL_FEATURES
        }
        for column, categories in self.categories_.items():
            if len(categories) >= 255:
                raise ValueError(
                    f"Categorical feature {column} has {len(categories)} training categories; "
                    "HistGradientBoosting requires fewer than max_bins=255"
                )
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        if tuple(X.columns) != tuple(self.feature_columns):
            raise ValueError("HistGradientBoosting feature columns must match the fitted schema")
        transformed = X.copy()
        for column, categories in self.categories_.items():
            values = transformed[column]
            known_values = values.where(values.isin(categories))
            transformed[column] = pd.Categorical(
                known_values, categories=categories, ordered=False
            )
        return transformed

    def get_feature_names_out(self, input_features=None) -> np.ndarray:
        if input_features is not None and tuple(input_features) != tuple(self.feature_columns):
            raise ValueError("input_features must match the fixed HistGradientBoosting schema")
        return np.asarray(self.feature_columns, dtype=object)


def _forest_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("numeric", "passthrough", list(NUMERIC_FEATURES)),
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", sparse_output=True, dtype=np.float32),
                list(CATEGORICAL_FEATURES),
            ),
        ],
        remainder="drop",
        sparse_threshold=1.0,
        verbose_feature_names_out=True,
    )


def build_tree_pipeline(config: TreeModelConfig) -> Pipeline:
    """Build the appropriate sparse-forest or native-category histogram pipeline."""
    if config.family == "extra_trees":
        estimator = ExtraTreesRegressor(**config.parameters)
        preprocessor = _forest_preprocessor()
    elif config.family == "random_forest":
        estimator = RandomForestRegressor(**config.parameters)
        preprocessor = _forest_preprocessor()
    elif config.family == "hist_gradient_boosting":
        if config.max_iter is None:
            raise ValueError("HistGradientBoosting configurations require max_iter")
        estimator = HistGradientBoostingRegressor(**config.parameters)
        preprocessor = TrainCategoryFramePreprocessor()
    else:
        raise ValueError(f"Unsupported tree model family: {config.family}")
    return Pipeline([("preprocessor", preprocessor), ("regressor", estimator)])


def _matrix_stats(pipeline: Pipeline, X_train: pd.DataFrame) -> tuple[tuple[int, int], str, int]:
    transformed = pipeline.named_steps["preprocessor"].transform(X_train)
    if hasattr(transformed, "nnz"):
        memory = (
            transformed.data.nbytes
            + transformed.indices.nbytes
            + transformed.indptr.nbytes
        )
        matrix_format = getattr(transformed, "format", "sparse")
    elif isinstance(transformed, pd.DataFrame):
        memory = int(transformed.memory_usage(index=True, deep=True).sum())
        matrix_format = "pandas DataFrame (dense numeric, categorical dtype)"
    else:
        memory = int(transformed.nbytes)
        matrix_format = "dense ndarray"
    return transformed.shape, matrix_format, memory


def _validate_partitions(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_validation: pd.DataFrame,
    y_validation: pd.Series,
) -> None:
    if not X_train.index.equals(y_train.index):
        raise ValueError("Training features and target must have identical indices")
    if not X_validation.index.equals(y_validation.index):
        raise ValueError("Validation features and target must have identical indices")
    if X_train.empty or X_validation.empty:
        raise ValueError("Training and validation partitions must both contain rows")


def evaluate_tree_validation_candidates(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_validation: pd.DataFrame,
    y_validation: pd.Series,
    configurations: tuple[TreeModelConfig, ...] | None = None,
) -> list[TreeValidationResult]:
    """Fit each fixed candidate using train only and report validation metrics."""
    _validate_partitions(X_train, y_train, X_validation, y_validation)
    configs = configurations if configurations is not None else tree_configurations()
    if not configs:
        raise ValueError("At least one tree configuration is required")

    results = []
    for config in configs:
        train_features = select_tree_features(X_train, config.family)
        validation_features = select_tree_features(X_validation, config.family)
        pipeline = build_tree_pipeline(config)
        fit_started = perf_counter()
        pipeline.fit(train_features, y_train)
        fit_seconds = perf_counter() - fit_started
        prediction_started = perf_counter()
        predicted = pipeline.predict(validation_features)
        prediction_seconds = perf_counter() - prediction_started
        predictions = pd.Series(predicted, index=y_validation.index, name="prediction")
        matrix_shape, matrix_format, matrix_memory_bytes = _matrix_stats(
            pipeline, train_features
        )
        results.append(
            TreeValidationResult(
                config=config,
                metrics=calculate_regression_metrics(y_validation, predictions),
                predictions=predictions,
                pipeline=pipeline,
                fit_seconds=fit_seconds,
                prediction_seconds=prediction_seconds,
                matrix_shape=matrix_shape,
                matrix_format=matrix_format,
                matrix_memory_bytes=matrix_memory_bytes,
                model_memory_bytes=len(
                    pickle.dumps(pipeline.named_steps["regressor"], protocol=pickle.HIGHEST_PROTOCOL)
                ),
            )
        )
    return results


def _complexity_key(config: TreeModelConfig) -> tuple[int, int, int]:
    iterations = config.max_iter if config.family == "hist_gradient_boosting" else 100
    max_leaves = 31 if config.family == "hist_gradient_boosting" else 0
    return (
        int(iterations),
        -config.min_samples_leaf,
        max_leaves,
    )


def _selection_key(result: TreeValidationResult) -> tuple[object, ...]:
    mape = result.metrics.mape_percent
    return (
        result.metrics.rmse_sgd,
        result.metrics.median_absolute_error_sgd,
        math.inf if mape is None else mape,
        *_complexity_key(result.config),
        result.fit_seconds + result.prediction_seconds,
        result.matrix_memory_bytes,
        result.config.family,
        result.config.config_id,
    )


def select_tree_candidate(results: list[TreeValidationResult]) -> TreeValidationResult:
    """Select from validation metrics only, using a 1% MAE band and stable ties."""
    if not results:
        raise ValueError("At least one validation result is required")
    best_mae = min(result.metrics.mae_sgd for result in results)
    threshold = best_mae if best_mae == 0 else best_mae * 1.01
    tied = [result for result in results if result.metrics.mae_sgd <= threshold]
    return min(tied, key=_selection_key)


def fit_selected_tree_model(
    config: TreeModelConfig,
    X_training: pd.DataFrame,
    y_training: pd.Series,
) -> Pipeline:
    """Refit the frozen configuration on only the historical rows supplied."""
    if not X_training.index.equals(y_training.index):
        raise ValueError("Final training features and target must have identical indices")
    if X_training.empty:
        raise ValueError("Final training data must contain at least one row")
    pipeline = build_tree_pipeline(config)
    pipeline.fit(select_tree_features(X_training, config.family), y_training)
    return pipeline


def aggregate_tree_feature_importances(pipeline: Pipeline) -> dict[str, float] | None:
    """Sum encoded impurity importances by their original source feature."""
    estimator = pipeline.named_steps["regressor"]
    if not hasattr(estimator, "feature_importances_"):
        return None
    preprocessor = pipeline.named_steps["preprocessor"]
    feature_names = preprocessor.get_feature_names_out()
    importances = np.asarray(estimator.feature_importances_, dtype=float)
    if len(feature_names) != len(importances):
        return None

    grouped: dict[str, float] = {}
    for name, importance in zip(feature_names, importances):
        if name.startswith("numeric__"):
            source_feature = name.removeprefix("numeric__")
        else:
            source_feature = next(
                (
                    column
                    for column in CATEGORICAL_FEATURES
                    if name.startswith(f"categorical__{column}_")
                ),
                str(name),
            )
        grouped[source_feature] = grouped.get(source_feature, 0.0) + float(importance)
    return dict(sorted(grouped.items(), key=lambda item: (-item[1], item[0])))
