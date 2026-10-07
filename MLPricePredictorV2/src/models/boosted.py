"""Leakage-safe CatBoost and XGBoost regression benchmarks."""

from dataclasses import dataclass
import json
import math
from pathlib import Path
import subprocess
import tempfile
from time import perf_counter
from typing import Literal
import warnings

import numpy as np
import pandas as pd

from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics
from src.models.linear import CATEGORICAL_FEATURES, MODEL_FEATURES, NUMERIC_FEATURES

BoostedFamily = Literal["catboost", "xgboost"]
ComputeDevice = Literal["cpu", "gpu"]
BOOSTED_FEATURES = MODEL_FEATURES
BOOSTED_CONFIGURATIONS = (
    ("catboost", 6, 0.03, None),
    ("catboost", 6, 0.05, None),
    ("catboost", 8, 0.03, None),
    ("catboost", 8, 0.05, None),
    ("xgboost", 6, 0.05, 5),
    ("xgboost", 6, 0.05, 10),
    ("xgboost", 8, 0.05, 5),
    ("xgboost", 8, 0.05, 10),
)
MAX_ITERATIONS = 2000
EARLY_STOPPING_ROUNDS = 100
RANDOM_SEED = 42
MISSING_CATEGORY = "__SGHOMIE_MISSING__"


@dataclass(frozen=True)
class BoostedModelConfig:
    family: BoostedFamily
    depth: int
    learning_rate: float
    min_child_weight: int | None = None

    @property
    def config_id(self) -> str:
        if self.family == "catboost":
            return f"catboost-depth_{self.depth}-lr_{self.learning_rate:g}"
        return (
            f"xgboost-depth_{self.depth}-min_child_weight_"
            f"{self.min_child_weight}"
        )

    def parameters_for(
        self,
        device: ComputeDevice,
        iterations: int = MAX_ITERATIONS,
        validation: bool = False,
    ) -> dict[str, object]:
        if device not in ("cpu", "gpu"):
            raise ValueError(f"Unsupported compute device: {device}")
        if iterations < 1:
            raise ValueError("iterations must be positive")
        if self.family == "catboost":
            parameters: dict[str, object] = {
                "iterations": iterations,
                "depth": self.depth,
                "learning_rate": self.learning_rate,
                "l2_leaf_reg": 3.0,
                "loss_function": "RMSE",
                "eval_metric": "MAE",
                "has_time": True,
                "random_seed": RANDOM_SEED,
                "allow_writing_files": False,
                "task_type": "GPU" if device == "gpu" else "CPU",
                "use_best_model": validation,
            }
            if validation:
                parameters.update({"od_type": "Iter", "od_wait": EARLY_STOPPING_ROUNDS})
            if device == "gpu":
                parameters["devices"] = "0"
            return parameters

        if self.min_child_weight not in (5, 10):
            raise ValueError("XGBoost configurations require min_child_weight 5 or 10")
        parameters = {
            "n_estimators": iterations,
            "max_depth": self.depth,
            "learning_rate": self.learning_rate,
            "min_child_weight": self.min_child_weight,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "reg_lambda": 1.0,
            "objective": "reg:squarederror",
            "eval_metric": "mae",
            "tree_method": "hist",
            "device": "cuda" if device == "gpu" else "cpu",
            "enable_categorical": True,
            "max_cat_to_onehot": 4,
            "max_cat_threshold": 64,
            "random_state": RANDOM_SEED,
            "n_jobs": -1,
        }
        if validation:
            parameters["early_stopping_rounds"] = EARLY_STOPPING_ROUNDS
        return parameters


@dataclass(frozen=True)
class BoostedValidationResult:
    config: BoostedModelConfig
    metrics: RegressionMetrics
    predictions: pd.Series
    best_iteration: int
    best_score: float
    fit_seconds: float
    prediction_seconds: float
    model_size_bytes: int


@dataclass(frozen=True)
class FittedBoostedModel:
    config: BoostedModelConfig
    iterations: int
    estimator: object
    category_preprocessor: "TrainCategoryPreprocessor | None"
    device: ComputeDevice


@dataclass(frozen=True)
class GpuDeviceInfo:
    index: int
    name: str
    memory_total_mib: int | None
    memory_used_mib: int | None
    utilization_percent: int | None


class TrainCategoryPreprocessor:
    """Learn XGBoost pandas category vocabularies from fit rows only."""

    def fit(self, features: pd.DataFrame) -> "TrainCategoryPreprocessor":
        selected = select_boosted_features(features)
        self.feature_columns_ = tuple(selected.columns)
        self.categories_ = {
            column: tuple(sorted(selected[column].dropna().unique().tolist()))
            for column in CATEGORICAL_FEATURES
        }
        return self

    def transform(self, features: pd.DataFrame) -> pd.DataFrame:
        selected = select_boosted_features(features)
        if tuple(selected.columns) != self.feature_columns_:
            raise ValueError("Feature columns do not match the fitted boosted schema")
        transformed = selected.copy()
        for column, categories in self.categories_.items():
            known = transformed[column].where(transformed[column].isin(categories))
            transformed[column] = pd.Categorical(known, categories=categories)
        return transformed


def boosted_configurations() -> tuple[BoostedModelConfig, ...]:
    """Return the fixed eight-candidate validation search."""
    return tuple(
        BoostedModelConfig(family, depth, learning_rate, min_child_weight)
        for family, depth, learning_rate, min_child_weight in BOOSTED_CONFIGURATIONS
    )


def select_boosted_features(features: pd.DataFrame) -> pd.DataFrame:
    """Return only the deterministic base feature schema, rejecting target leakage."""
    if "resale_price" in features.columns:
        raise ValueError("Model features must not contain resale_price")
    invalid_derived = "price_per_sqm"
    if invalid_derived in features.columns:
        raise ValueError(f"Model features must not contain target-derived {invalid_derived}")
    missing = [column for column in BOOSTED_FEATURES if column not in features.columns]
    if missing:
        raise ValueError(f"Model features are missing required columns: {', '.join(missing)}")
    return features.loc[:, BOOSTED_FEATURES].copy()


def prepare_catboost_features(features: pd.DataFrame) -> pd.DataFrame:
    """Keep categories as native strings and give missing values a fixed token."""
    selected = select_boosted_features(features)
    for column in CATEGORICAL_FEATURES:
        values = selected[column].astype("string")
        if values.eq(MISSING_CATEGORY).any():
            raise ValueError(f"Reserved missing-value token appears in {column}")
        selected[column] = values.fillna(MISSING_CATEGORY).astype(object)
    return selected


def _ordered_rows(
    features: pd.DataFrame, target: pd.Series
) -> tuple[pd.DataFrame, pd.Series]:
    if not features.index.equals(target.index):
        raise ValueError("Features and target must have identical indices")
    selected = select_boosted_features(features)
    sort_frame = pd.DataFrame(
        {
            "transaction_year": selected["transaction_year"].to_numpy(),
            "transaction_month": selected["transaction_month"].to_numpy(),
            "position": np.arange(len(selected)),
        }
    )
    positions = sort_frame.sort_values(
        ["transaction_year", "transaction_month", "position"], kind="stable"
    )["position"].to_numpy(dtype=int)
    return selected.iloc[positions].copy(), target.iloc[positions].copy()


def build_boosted_estimator(
    config: BoostedModelConfig,
    device: ComputeDevice = "cpu",
    iterations: int = MAX_ITERATIONS,
    validation: bool = False,
):
    """Construct a model without probing or silently changing its device."""
    parameters = config.parameters_for(device, iterations=iterations, validation=validation)
    if config.family == "catboost":
        from catboost import CatBoostRegressor

        return CatBoostRegressor(**parameters)
    from xgboost import XGBRegressor

    return XGBRegressor(**parameters)


def _catboost_best_score(estimator) -> float:
    score_data = estimator.get_best_score()
    for dataset_name, metrics in score_data.items():
        if dataset_name.lower().startswith("validation") and "MAE" in metrics:
            return float(metrics["MAE"])
    raise ValueError(f"CatBoost did not return a validation MAE score: {score_data}")


def _serialize_model_size(estimator, family: BoostedFamily) -> int:
    suffix = ".cbm" if family == "catboost" else ".ubj"
    with tempfile.TemporaryDirectory(prefix="sghomie-model-size-") as directory:
        model_path = Path(directory) / f"candidate{suffix}"
        estimator.save_model(str(model_path))
        return model_path.stat().st_size


def _candidate_data(
    config: BoostedModelConfig,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_validation: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, TrainCategoryPreprocessor | None]:
    if config.family == "catboost":
        return (
            prepare_catboost_features(X_train),
            prepare_catboost_features(X_validation),
            None,
        )
    preprocessor = TrainCategoryPreprocessor().fit(X_train)
    return preprocessor.transform(X_train), preprocessor.transform(X_validation), preprocessor


def evaluate_boosted_candidates(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_validation: pd.DataFrame,
    y_validation: pd.Series,
    configurations: tuple[BoostedModelConfig, ...] | None = None,
    device: ComputeDevice = "cpu",
) -> list[BoostedValidationResult]:
    """Fit validation candidates on train rows, with validation used only for stopping/scoring."""
    if not X_train.index.equals(y_train.index):
        raise ValueError("Training features and target must have identical indices")
    if not X_validation.index.equals(y_validation.index):
        raise ValueError("Validation features and target must have identical indices")
    if X_train.empty or X_validation.empty:
        raise ValueError("Training and validation partitions must both contain rows")
    train_features, train_target = _ordered_rows(X_train, y_train)
    validation_features, validation_target = _ordered_rows(X_validation, y_validation)
    configs = configurations if configurations is not None else boosted_configurations()
    if not configs:
        raise ValueError("At least one boosted configuration is required")

    results = []
    for config in configs:
        train_data, validation_data, _ = _candidate_data(
            config, train_features, train_target, validation_features
        )
        estimator = build_boosted_estimator(config, device, validation=True)
        fit_started = perf_counter()
        if config.family == "catboost":
            estimator.fit(
                train_data,
                train_target,
                cat_features=list(CATEGORICAL_FEATURES),
                eval_set=(validation_data, validation_target),
                verbose=False,
            )
            best_iteration = int(estimator.get_best_iteration())
            best_score = _catboost_best_score(estimator)
        else:
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                estimator.fit(
                    train_data,
                    train_target,
                    eval_set=[(validation_data, validation_target)],
                    verbose=False,
                )
            if device == "gpu" and any(
                "no visible gpu" in str(item.message).lower() for item in caught
            ):
                raise RuntimeError("XGBoost reported no visible GPU; GPU execution was not verified")
            best_iteration = int(estimator.best_iteration)
            best_score = float(estimator.best_score)
        fit_seconds = perf_counter() - fit_started

        prediction_started = perf_counter()
        prediction_values = estimator.predict(validation_data)
        prediction_seconds = perf_counter() - prediction_started
        ordered_predictions = pd.Series(
            prediction_values, index=validation_features.index, name="prediction"
        )
        predictions = ordered_predictions.reindex(y_validation.index)
        metrics = calculate_regression_metrics(y_validation, predictions)
        model_size_bytes = _serialize_model_size(estimator, config.family)
        results.append(
            BoostedValidationResult(
                config=config,
                metrics=metrics,
                predictions=predictions,
                best_iteration=best_iteration,
                best_score=best_score,
                fit_seconds=fit_seconds,
                prediction_seconds=prediction_seconds,
                model_size_bytes=model_size_bytes,
            )
        )
        del estimator
    return results


def _selection_key(result: BoostedValidationResult) -> tuple[object, ...]:
    mape = result.metrics.mape_percent
    return (
        result.metrics.rmse_sgd,
        result.metrics.median_absolute_error_sgd,
        math.inf if mape is None else mape,
        result.config.depth,
        result.best_iteration + 1,
        result.model_size_bytes,
        result.fit_seconds,
        result.prediction_seconds,
        result.config.family,
        result.config.config_id,
    )


def select_boosted_candidate(
    results: list[BoostedValidationResult],
) -> BoostedValidationResult:
    """Select by validation MAE band and deterministic validation/resource ties only."""
    if not results:
        raise ValueError("At least one boosted validation result is required")
    best_mae = min(result.metrics.mae_sgd for result in results)
    cutoff = best_mae if best_mae == 0 else best_mae * 1.01
    tied = [result for result in results if result.metrics.mae_sgd <= cutoff]
    return min(tied, key=_selection_key)


def fit_selected_boosted_model(
    selected: BoostedValidationResult,
    X_training: pd.DataFrame,
    y_training: pd.Series,
    device: ComputeDevice = "cpu",
) -> FittedBoostedModel:
    """Refit frozen validation choices on only the supplied historical data."""
    training_features, training_target = _ordered_rows(X_training, y_training)
    if training_features.empty:
        raise ValueError("Final training data must contain at least one row")
    iterations = selected.best_iteration + 1
    if selected.config.family == "catboost":
        estimator = build_boosted_estimator(
            selected.config, device, iterations=iterations, validation=False
        )
        prepared = prepare_catboost_features(training_features)
        estimator.fit(
            prepared,
            training_target,
            cat_features=list(CATEGORICAL_FEATURES),
            verbose=False,
        )
        preprocessor = None
    else:
        preprocessor = TrainCategoryPreprocessor().fit(training_features)
        prepared = preprocessor.transform(training_features)
        estimator = build_boosted_estimator(
            selected.config, device, iterations=iterations, validation=False
        )
        estimator.fit(prepared, training_target, verbose=False)
    return FittedBoostedModel(
        config=selected.config,
        iterations=iterations,
        estimator=estimator,
        category_preprocessor=preprocessor,
        device=device,
    )


def predict_boosted_model(model: FittedBoostedModel, features: pd.DataFrame) -> pd.Series:
    """Predict without fitting or modifying model preprocessing."""
    selected = select_boosted_features(features)
    if model.config.family == "catboost":
        prepared = prepare_catboost_features(selected)
    else:
        if model.category_preprocessor is None:
            raise ValueError("XGBoost inference requires its fitted category preprocessor")
        prepared = model.category_preprocessor.transform(selected)
    return pd.Series(model.estimator.predict(prepared), index=features.index, name="prediction")


def feature_importance(model: FittedBoostedModel) -> list[tuple[str, float]]:
    """Return a compact, model-native source-feature importance ranking."""
    if model.config.family == "catboost":
        values = model.estimator.get_feature_importance()
        names = model.estimator.feature_names_
    else:
        booster = model.estimator.get_booster()
        values_by_name = booster.get_score(importance_type="gain")
        names = list(MODEL_FEATURES)
        values = [values_by_name.get(name, 0.0) for name in names]
    ranked = sorted(
        ((str(name), float(value)) for name, value in zip(names, values)),
        key=lambda item: (-item[1], item[0]),
    )
    return ranked[:10]


def dataframe_memory_bytes(features: pd.DataFrame) -> int:
    """Approximate DataFrame storage including category/string payloads."""
    return int(features.memory_usage(index=True, deep=True).sum())


def detect_gpu_devices() -> tuple[GpuDeviceInfo, ...]:
    """Read available NVIDIA devices and telemetry from nvidia-smi, if present."""
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=index,name,memory.total,memory.used,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ()
    if result.returncode != 0:
        return ()
    devices = []
    for line in result.stdout.splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) != 5:
            continue

        def number(value: str) -> int | None:
            try:
                return int(value)
            except ValueError:
                return None

        index = number(parts[0])
        if index is None:
            continue
        devices.append(
            GpuDeviceInfo(index, parts[1], number(parts[2]), number(parts[3]), number(parts[4]))
        )
    return tuple(devices)


def verify_gpu_libraries() -> dict[str, object]:
    """Require both model libraries to report and successfully use CUDA device 0."""
    devices = detect_gpu_devices()
    if not any(device.index == 0 for device in devices):
        raise RuntimeError("GPU was requested, but nvidia-smi did not detect GPU index 0")
    try:
        from catboost import CatBoostRegressor
        from catboost.utils import get_gpu_device_count
        import xgboost as xgb
        from xgboost import XGBRegressor
    except ImportError as error:
        raise RuntimeError(
            "GPU mode requires the CatBoost and XGBoost dependencies; install requirements.txt"
        ) from error
    catboost_gpu_count = int(get_gpu_device_count())
    if catboost_gpu_count < 1:
        raise RuntimeError("CatBoost package reports no GPU-capable devices")
    build_info = xgb.build_info()
    if build_info.get("USE_CUDA") is False:
        raise RuntimeError("Installed XGBoost build reports USE_CUDA=False")

    cat_features = pd.DataFrame(
        {"category": ["A", "B", "A", "B"], "numeric": [0.0, 1.0, 2.0, 3.0]}
    )
    cat_target = pd.Series([100.0, 200.0, 150.0, 250.0])
    cat_probe = CatBoostRegressor(
        iterations=2,
        depth=2,
        task_type="GPU",
        devices="0",
        loss_function="RMSE",
        allow_writing_files=False,
        verbose=False,
        random_seed=RANDOM_SEED,
    )
    cat_probe.fit(cat_features, cat_target, cat_features=["category"], verbose=False)

    xgb_features = pd.DataFrame(
        {
            "category": pd.Categorical(["A", "B", "A", "B"]),
            "numeric": [0.0, 1.0, 2.0, 3.0],
        }
    )
    xgb_probe = XGBRegressor(
        n_estimators=2,
        max_depth=2,
        tree_method="hist",
        device="cuda:0",
        enable_categorical=True,
        objective="reg:squarederror",
        n_jobs=-1,
        random_state=RANDOM_SEED,
    )
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        xgb_probe.fit(xgb_features, cat_target, verbose=False)
    if any("no visible gpu" in str(item.message).lower() for item in caught):
        raise RuntimeError("XGBoost smoke fit fell back because no visible GPU was found")
    booster_config = json.loads(xgb_probe.get_booster().save_config())
    configured_device = booster_config["learner"]["generic_param"].get("device", "")
    if not str(configured_device).startswith("cuda"):
        raise RuntimeError(f"XGBoost smoke fit did not use CUDA (device={configured_device!r})")
    device_zero = next(device for device in devices if device.index == 0)
    return {
        "device": device_zero,
        "catboost_version": __import__("catboost").__version__,
        "catboost_gpu_device_count": catboost_gpu_count,
        "xgboost_version": xgb.__version__,
        "xgboost_build_info": build_info,
        "xgboost_smoke_device": configured_device,
        "catboost_smoke_fit": True,
        "xgboost_smoke_fit": True,
    }
