"""Versioned CatBoost valuation bundles and compact conformal state."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
from typing import Mapping, Sequence

import numpy as np
import pandas as pd

from src.evaluation.uncertainty import (
    COVERAGE_LEVELS,
    MIN_GROUP_CALIBRATION_SUPPORT,
    finite_sample_conformal_quantile,
)
from src.models.boosted import (
    BOOSTED_FEATURES,
    CATEGORICAL_FEATURES,
    FROZEN_CATBOOST_CONFIG,
    FROZEN_CATBOOST_ITERATIONS,
    NUMERIC_FEATURES,
    prepare_catboost_features,
)

BUNDLE_FORMAT_VERSION = 1
FEATURE_SCHEMA_VERSION = "hdb-resale-features-v1"
DEFAULT_MODEL_VERSION = "hdb-catboost-2025-12-v1"
DEFAULT_COVERAGE_LEVEL = 0.90
SUPPORTED_COVERAGE_LEVELS = COVERAGE_LEVELS
CALIBRATION_CUTOFF = "2025-12"
CALIBRATION_YEARS = (2021, 2022, 2023, 2024, 2025)
CALIBRATION_METHOD = "town_all_years"
INFERENCE_UNCERTAINTY_METHOD = "town_conformal"
MODEL_FILENAME = "model.cbm"
UNCERTAINTY_FILENAME = "uncertainty.json"
METADATA_FILENAME = "metadata.json"
MANIFEST_FILENAME = "manifest.json"
REQUIRED_BUNDLE_FILES = (
    MODEL_FILENAME,
    UNCERTAINTY_FILENAME,
    METADATA_FILENAME,
    MANIFEST_FILENAME,
)
UNSUPPORTED_COVERAGE_MESSAGE = (
    "coverage must be one of the supported levels: 0.8, 0.9, 0.95"
)
PREDICTION_RTOL = 1e-12
PREDICTION_ATOL = 1e-8
TOWN_THRESHOLD_ATOL = 0.0


@dataclass(frozen=True)
class OutOfSamplePredictionFold:
    """Features and predictions for one year made by a model fit before that year."""

    year: int
    features: pd.DataFrame
    predictions: pd.Series


@dataclass(frozen=True)
class UncertaintyThreshold:
    town: str
    coverage: float
    q_sgd: float
    support_count: int
    used_global_fallback: bool

    @property
    def full_width_sgd(self) -> float:
        return 2.0 * self.q_sgd


@dataclass(frozen=True)
class ValuationPrediction:
    estimated_value: float
    lower_bound: float
    upper_bound: float
    interval_half_width: float
    interval_full_width: float
    coverage_target: float
    model_version: str
    uncertainty_method: str
    uncertainty_group: str
    calibration_support_count: int
    used_global_fallback: bool


@dataclass(frozen=True)
class LoadedValuationBundle:
    """A verified native CatBoost model and compact inference-time calibration."""

    directory: Path
    metadata: dict[str, object]
    uncertainty: dict[str, object]
    model: object

    @property
    def model_version(self) -> str:
        return str(self.metadata["model_version"])

    def get_uncertainty_threshold(
        self, town: str, coverage: float = DEFAULT_COVERAGE_LEVEL
    ) -> UncertaintyThreshold:
        return get_uncertainty_threshold(self.uncertainty, town, coverage)

    def predict_one(
        self,
        features: Mapping[str, object],
        coverage: float = DEFAULT_COVERAGE_LEVEL,
    ) -> ValuationPrediction:
        _coverage_key(coverage)
        row = _validate_prediction_features(features)
        model_frame = pd.DataFrame([row], columns=BOOSTED_FEATURES)
        prepared = prepare_catboost_features(model_frame)
        estimated_value = float(np.asarray(self.model.predict(prepared)).reshape(-1)[0])
        if not math.isfinite(estimated_value):
            raise ValueError("CatBoost returned a non-finite valuation estimate")
        town = str(row["town"])
        threshold = self.get_uncertainty_threshold(town, coverage)
        return ValuationPrediction(
            estimated_value=estimated_value,
            lower_bound=estimated_value - threshold.q_sgd,
            upper_bound=estimated_value + threshold.q_sgd,
            interval_half_width=threshold.q_sgd,
            interval_full_width=threshold.full_width_sgd,
            coverage_target=float(coverage),
            model_version=self.model_version,
            uncertainty_method=INFERENCE_UNCERTAINTY_METHOD,
            uncertainty_group=threshold.town,
            calibration_support_count=threshold.support_count,
            used_global_fallback=threshold.used_global_fallback,
        )


def normalize_town(town: str) -> str:
    """Match the active application's trim-and-uppercase town convention."""
    if not isinstance(town, str) or not town.strip():
        raise ValueError("town must be a non-empty string")
    return town.strip().upper()


def build_calibration_residuals(
    folds: Sequence[OutOfSamplePredictionFold],
    actual_values: pd.Series,
) -> pd.DataFrame:
    """Build only the approved 2021-2025 out-of-sample residual history."""
    folds_by_year: dict[int, OutOfSamplePredictionFold] = {}
    for fold in folds:
        if fold.year > 2025:
            raise ValueError("Calibration prediction fold years must not exceed 2025")
        if fold.year not in CALIBRATION_YEARS:
            raise ValueError(f"Unexpected calibration fold year: {fold.year}")
        if fold.year in folds_by_year:
            raise ValueError(f"Duplicate calibration prediction fold for {fold.year}")
        folds_by_year[fold.year] = fold
    if tuple(sorted(folds_by_year)) != CALIBRATION_YEARS:
        raise ValueError("Calibration requires exactly one out-of-sample fold for 2021-2025")

    rows = []
    for year in CALIBRATION_YEARS:
        fold = folds_by_year[year]
        missing_group_features = {"town", "flat_type"}.difference(fold.features.columns)
        if missing_group_features:
            raise ValueError(
                "Calibration fold is missing group features: "
                + ", ".join(sorted(missing_group_features))
            )
        if not fold.features.index.equals(fold.predictions.index):
            raise ValueError("Calibration fold features and predictions must have identical indices")
        if fold.features.index.has_duplicates:
            raise ValueError("Calibration fold source indices must be unique")
        actual = actual_values.reindex(fold.features.index)
        prediction = pd.to_numeric(fold.predictions, errors="coerce")
        actual_numeric = pd.to_numeric(actual, errors="coerce")
        if actual_numeric.isna().any() or prediction.isna().any():
            raise ValueError(f"Calibration fold {year} contains missing targets or predictions")
        actual_array = actual_numeric.to_numpy(dtype=float)
        prediction_array = prediction.to_numpy(dtype=float)
        if not np.isfinite(actual_array).all() or not np.isfinite(prediction_array).all():
            raise ValueError(f"Calibration fold {year} contains non-finite targets or predictions")
        town_values = fold.features["town"].map(normalize_town)
        flat_type_values = fold.features["flat_type"]
        if flat_type_values.isna().any() or not flat_type_values.map(
            lambda value: isinstance(value, str) and bool(value.strip())
        ).all():
            raise ValueError(f"Calibration fold {year} contains an invalid flat_type")
        rows.append(
            pd.DataFrame(
                {
                    "year": year,
                    "town": town_values.to_numpy(),
                    "flat_type": flat_type_values.to_numpy(),
                    "residual_sgd": np.abs(actual_array - prediction_array),
                },
                index=fold.features.index,
            )
        )
    return pd.concat(rows, axis=0)


def build_uncertainty_state(
    residual_history: pd.DataFrame,
    calibration_cutoff: str = CALIBRATION_CUTOFF,
) -> dict[str, object]:
    """Compress pre-2026 residuals to exact global and eligible-town quantiles."""
    cutoff = _parse_cutoff(calibration_cutoff, "calibration cutoff")
    if str(cutoff) != CALIBRATION_CUTOFF:
        raise ValueError(f"Calibration cutoff must be {CALIBRATION_CUTOFF}")
    required = {"year", "town", "flat_type", "residual_sgd"}
    missing = required.difference(residual_history.columns)
    if missing:
        raise ValueError("Residual history is missing columns: " + ", ".join(sorted(missing)))
    years = pd.to_numeric(residual_history["year"], errors="coerce")
    if years.isna().any() or not np.isfinite(years.to_numpy(dtype=float)).all():
        raise ValueError("Calibration residual years must be finite")
    if (years > cutoff.year).any():
        raise ValueError("Calibration residuals contain rows after calibration cutoff 2025-12")
    if set(years.astype(int).unique()) != set(CALIBRATION_YEARS):
        raise ValueError("Calibration residual history must cover exactly 2021-2025")
    residuals = pd.to_numeric(residual_history["residual_sgd"], errors="coerce")
    values = residuals.to_numpy(dtype=float)
    if not len(values) or not np.isfinite(values).all() or (values < 0).any():
        raise ValueError("Calibration residuals must be non-empty, finite, and non-negative")
    towns = residual_history["town"].map(normalize_town)
    if residual_history["flat_type"].isna().any():
        raise ValueError("Calibration flat_type values must not be missing")

    global_thresholds = {
        _coverage_key(level): finite_sample_conformal_quantile(values, level)
        for level in SUPPORTED_COVERAGE_LEVELS
    }
    town_groups: dict[str, object] = {}
    normalized = residual_history.assign(
        town=towns.to_numpy(), residual_sgd=values, year=years.astype(int).to_numpy()
    )
    for town, group in normalized.groupby("town", sort=True):
        if len(group) < MIN_GROUP_CALIBRATION_SUPPORT:
            continue
        town_groups[str(town)] = {
            "support_count": int(len(group)),
            "thresholds": {
                _coverage_key(level): finite_sample_conformal_quantile(
                    group["residual_sgd"].to_numpy(dtype=float), level
                )
                for level in SUPPORTED_COVERAGE_LEVELS
            },
        }
    return {
        "schema_version": 1,
        "method_name": CALIBRATION_METHOD,
        "inference_method": INFERENCE_UNCERTAINTY_METHOD,
        "calibration_cutoff": calibration_cutoff,
        "calibration_years": list(CALIBRATION_YEARS),
        "grouping_variable": "town",
        "minimum_group_support": MIN_GROUP_CALIBRATION_SUPPORT,
        "finite_sample_quantile_rule": "1-indexed order statistic at ceil((n + 1) * p)",
        "fallback_rule": "Use global quantile for unknown or under-supported towns.",
        "supported_coverage_levels": list(SUPPORTED_COVERAGE_LEVELS),
        "default_coverage_level": DEFAULT_COVERAGE_LEVEL,
        "global": {
            "support_count": int(len(values)),
            "thresholds": global_thresholds,
        },
        "towns": town_groups,
    }


def get_uncertainty_threshold(
    uncertainty: Mapping[str, object], town: str, coverage: float
) -> UncertaintyThreshold:
    """Look up exact stored q; use the persisted global threshold for fallback."""
    key = _coverage_key(coverage)
    canonical_town = normalize_town(town)
    global_record = uncertainty["global"]
    if not isinstance(global_record, Mapping):
        raise ValueError("Uncertainty calibration global record is invalid")
    global_thresholds = global_record.get("thresholds")
    if not isinstance(global_thresholds, Mapping) or key not in global_thresholds:
        raise ValueError(f"Uncertainty calibration does not contain coverage {coverage}")
    towns = uncertainty.get("towns")
    if not isinstance(towns, Mapping):
        raise ValueError("Uncertainty calibration town records are invalid")
    town_record = towns.get(canonical_town)
    if isinstance(town_record, Mapping):
        threshold_map = town_record.get("thresholds")
        support = town_record.get("support_count")
        if (
            isinstance(threshold_map, Mapping)
            and key in threshold_map
            and isinstance(support, int)
            and support >= MIN_GROUP_CALIBRATION_SUPPORT
        ):
            return UncertaintyThreshold(
                canonical_town,
                float(coverage),
                _finite_nonnegative(threshold_map[key], "town q"),
                support,
                False,
            )
    global_support = global_record.get("support_count")
    if not isinstance(global_support, int) or global_support < 1:
        raise ValueError("Uncertainty calibration global support count is invalid")
    return UncertaintyThreshold(
        canonical_town,
        float(coverage),
        _finite_nonnegative(global_thresholds[key], "global q"),
        global_support,
        True,
    )


def create_bundle_metadata(
    *,
    training_row_count: int,
    training_device: str,
    source_dataset_coverage: tuple[str, str],
    uncertainty_state: Mapping[str, object],
    created_at: str | None = None,
) -> dict[str, object]:
    """Create auditable metadata for the one frozen research bundle."""
    if training_device not in ("cpu", "gpu"):
        raise ValueError("training_device must be cpu or gpu")
    from catboost import __version__ as catboost_version

    from src.models.boosted import FROZEN_CATBOOST_CONFIG

    uncertainty_global = uncertainty_state["global"]
    if not isinstance(uncertainty_global, Mapping):
        raise ValueError("Uncertainty state has no global thresholds")
    now = created_at or datetime.now(timezone.utc).isoformat(timespec="seconds")
    parameters = FROZEN_CATBOOST_CONFIG.parameters_for(
        training_device, iterations=FROZEN_CATBOOST_ITERATIONS, validation=False
    )
    return {
        "bundle_format_version": BUNDLE_FORMAT_VERSION,
        "model_version": DEFAULT_MODEL_VERSION,
        "model_family": "catboost",
        "model_filename": MODEL_FILENAME,
        "model_serialization_format": "cbm",
        "training_cutoff": CALIBRATION_CUTOFF,
        "training_row_count": int(training_row_count),
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "feature_order": list(BOOSTED_FEATURES),
        "numeric_features": list(NUMERIC_FEATURES),
        "categorical_features": list(CATEGORICAL_FEATURES),
        "target_name": "resale_price",
        "catboost_parameters": parameters,
        "random_seed": 42,
        "iteration_count": FROZEN_CATBOOST_ITERATIONS,
        "training_device": training_device,
        "dataset": {
            "name": "Resale flat prices based on registration date from Jan-2017 onwards",
            "publisher": "Housing & Development Board via data.gov.sg",
            "resource_id": "d_8b84c4ee58e3cfc0ece0d773c8ca6abc",
            "retrieval_date": "2026-10-04",
            "source_coverage_start": source_dataset_coverage[0],
            "source_coverage_end": source_dataset_coverage[1],
        },
        "library_versions": {
            "python": __import__("platform").python_version(),
            "catboost": catboost_version,
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
        "created_at": now,
        "uncertainty_method": uncertainty_state["method_name"],
        "calibration_cutoff": uncertainty_state["calibration_cutoff"],
        "supported_coverage_levels": list(SUPPORTED_COVERAGE_LEVELS),
        "default_coverage_level": DEFAULT_COVERAGE_LEVEL,
        "grouping_variable": "town",
        "fallback_behavior": uncertainty_state["fallback_rule"],
        "minimum_group_support": MIN_GROUP_CALIBRATION_SUPPORT,
        "global_conformal_thresholds": dict(uncertainty_global["thresholds"]),
        "eligible_town_count": len(uncertainty_state["towns"]),
        "point_model_research_metrics": {
            "validation_year": 2025,
            "mae_sgd": 33524.38,
            "rmse_sgd": 45217.47,
            "mape_percent": 5.02,
            "r_squared": 0.9509,
            "median_absolute_error_sgd": 26456.09,
        },
        "uncertainty_research_metrics": {
            "evaluation_years": [2022, 2023, 2024, 2025],
            "pooled_90_percent_coverage": 0.9183,
            "minimum_annual_90_percent_coverage": 0.85,
            "historical_gate_passed": True,
        },
        "known_limitations": [
            "Research candidate; not a production-approved or official valuation.",
            "GPU training may vary slightly across runs; saved-artifact inference is the reproducibility target.",
            "Historical and 2026 diagnostics showed undercoverage in some towns, Executive flats, and the highest-price quartile.",
        ],
    }


def validate_metadata(metadata: Mapping[str, object]) -> None:
    """Reject unsupported or inconsistent feature/model metadata."""
    if not isinstance(metadata, Mapping):
        raise ValueError("Bundle metadata must be a JSON object")
    required = {
        "bundle_format_version",
        "model_version",
        "model_family",
        "model_filename",
        "model_serialization_format",
        "training_cutoff",
        "training_row_count",
        "feature_schema_version",
        "feature_order",
        "numeric_features",
        "categorical_features",
        "target_name",
        "catboost_parameters",
        "random_seed",
        "iteration_count",
        "dataset",
        "library_versions",
        "created_at",
        "uncertainty_method",
        "calibration_cutoff",
        "supported_coverage_levels",
        "default_coverage_level",
        "grouping_variable",
        "fallback_behavior",
        "minimum_group_support",
        "global_conformal_thresholds",
        "eligible_town_count",
        "point_model_research_metrics",
        "uncertainty_research_metrics",
        "known_limitations",
    }
    missing = required.difference(metadata)
    if missing:
        raise ValueError("Bundle metadata is missing required fields: " + ", ".join(sorted(missing)))
    if metadata["bundle_format_version"] != BUNDLE_FORMAT_VERSION:
        raise ValueError(f"Unsupported bundle format: {metadata['bundle_format_version']!r}")
    if metadata["model_family"] != "catboost" or metadata["model_filename"] != MODEL_FILENAME:
        raise ValueError("Bundle metadata must reference the CatBoost model.cbm artifact")
    if metadata["model_serialization_format"] != "cbm":
        raise ValueError("Bundle model serialization format must be cbm")
    version = metadata["model_version"]
    if not isinstance(version, str) or not re.fullmatch(r"hdb-catboost-2025-12-v[1-9][0-9]*", version):
        raise ValueError("Invalid model version; expected hdb-catboost-2025-12-vN")
    if metadata["training_cutoff"] != CALIBRATION_CUTOFF:
        raise ValueError(f"Bundle training cutoff must be {CALIBRATION_CUTOFF}")
    cutoff = _parse_cutoff(metadata["calibration_cutoff"], "calibration cutoff")
    if str(cutoff) != CALIBRATION_CUTOFF:
        raise ValueError(f"Bundle calibration cutoff must be {CALIBRATION_CUTOFF}")
    if cutoff > _parse_cutoff(metadata["training_cutoff"], "training cutoff"):
        raise ValueError("Calibration cutoff must not be after the model training cutoff")
    if metadata["feature_schema_version"] != FEATURE_SCHEMA_VERSION:
        raise ValueError("Unsupported feature schema version")
    if metadata["feature_order"] != list(BOOSTED_FEATURES):
        raise ValueError("Bundle feature order does not match the frozen CatBoost contract")
    if metadata["numeric_features"] != list(NUMERIC_FEATURES):
        raise ValueError("Bundle numeric feature contract is invalid")
    if metadata["categorical_features"] != list(CATEGORICAL_FEATURES):
        raise ValueError("Bundle categorical feature contract is invalid")
    if metadata["target_name"] != "resale_price" or "resale_price" in metadata["feature_order"]:
        raise ValueError("Target must be resale_price and must be excluded from model features")
    if metadata["random_seed"] != 42 or metadata["iteration_count"] != FROZEN_CATBOOST_ITERATIONS:
        raise ValueError("Bundle CatBoost seed or iteration count differs from the frozen model")
    parameters = metadata["catboost_parameters"]
    if not isinstance(parameters, Mapping):
        raise ValueError("Bundle CatBoost parameters must be an object")
    expected_parameters = {
        "depth": 8,
        "learning_rate": 0.05,
        "l2_leaf_reg": 3.0,
        "random_seed": 42,
        "iterations": FROZEN_CATBOOST_ITERATIONS,
        "has_time": True,
        "loss_function": "RMSE",
        "eval_metric": "MAE",
    }
    if any(parameters.get(key) != value for key, value in expected_parameters.items()):
        raise ValueError("Bundle CatBoost parameters differ from the frozen model configuration")
    if not isinstance(metadata["training_row_count"], int) or metadata["training_row_count"] < 1:
        raise ValueError("Bundle training_row_count must be a positive integer")
    if metadata["minimum_group_support"] != MIN_GROUP_CALIBRATION_SUPPORT:
        raise ValueError("Bundle minimum group support differs from the selected calibration rule")
    if metadata["supported_coverage_levels"] != list(SUPPORTED_COVERAGE_LEVELS):
        raise ValueError("Bundle supported coverage levels are invalid")
    if metadata["default_coverage_level"] != DEFAULT_COVERAGE_LEVEL:
        raise ValueError("Bundle default coverage must be 90%")
    if metadata["uncertainty_method"] != CALIBRATION_METHOD or metadata["grouping_variable"] != "town":
        raise ValueError("Bundle uncertainty method or grouping variable is invalid")
    for field in ("dataset", "library_versions", "global_conformal_thresholds", "point_model_research_metrics", "uncertainty_research_metrics"):
        if not isinstance(metadata[field], Mapping):
            raise ValueError(f"Bundle metadata field {field} must be an object")
    if not isinstance(metadata["known_limitations"], list) or not metadata["known_limitations"]:
        raise ValueError("Bundle known_limitations must be a non-empty list")
    _parse_timestamp(metadata["created_at"])
    _validate_versioned_values(metadata)


def write_bundle(
    bundle_directory: Path | str,
    estimator: object,
    metadata: Mapping[str, object],
    uncertainty_state: Mapping[str, object],
) -> None:
    """Write one immutable bundle directory with a non-circular SHA-256 manifest."""
    destination = Path(bundle_directory)
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite immutable bundle version: {destination}")
    validate_metadata(metadata)
    validate_uncertainty_state(uncertainty_state)
    if metadata["model_version"] != destination.name:
        raise ValueError("Bundle directory name must equal metadata model_version")
    _validate_global_threshold_copy(metadata, uncertainty_state)
    _validate_estimator_feature_names(estimator)
    destination.mkdir(parents=True, exist_ok=False)
    try:
        estimator.save_model(str(destination / MODEL_FILENAME), format="cbm")
        _write_json(destination / UNCERTAINTY_FILENAME, uncertainty_state)
        _write_json(destination / METADATA_FILENAME, metadata)
        manifest = {
            "manifest_version": 1,
            "hash_algorithm": "sha256",
            "files": {
                filename: _sha256_file(destination / filename)
                for filename in (MODEL_FILENAME, UNCERTAINTY_FILENAME, METADATA_FILENAME)
            },
        }
        _write_json(destination / MANIFEST_FILENAME, manifest)
    except Exception:
        for child in destination.iterdir():
            child.unlink()
        destination.rmdir()
        raise


def load_bundle(bundle_directory: Path | str) -> LoadedValuationBundle:
    """Verify a trusted local bundle completely before returning it for inference."""
    directory = Path(bundle_directory)
    missing = [name for name in REQUIRED_BUNDLE_FILES if not (directory / name).is_file()]
    if missing:
        raise ValueError("Bundle is missing required bundle files: " + ", ".join(missing))
    manifest = _read_json(directory / MANIFEST_FILENAME, "manifest")
    _validate_manifest(manifest)
    for filename in (MODEL_FILENAME, UNCERTAINTY_FILENAME, METADATA_FILENAME):
        expected = manifest["files"][filename]
        observed = _sha256_file(directory / filename)
        if observed != expected:
            raise ValueError(f"Bundle checksum mismatch for {filename}")
    metadata = _read_json(directory / METADATA_FILENAME, "metadata")
    validate_metadata(metadata)
    if metadata["model_version"] != directory.name:
        raise ValueError("Bundle directory does not match metadata model_version")
    uncertainty = _read_json(directory / UNCERTAINTY_FILENAME, "uncertainty")
    validate_uncertainty_state(uncertainty)
    _validate_global_threshold_copy(metadata, uncertainty)

    try:
        from catboost import CatBoostRegressor

        model = CatBoostRegressor()
        model.load_model(str(directory / MODEL_FILENAME), format="cbm")
    except Exception as error:
        raise ValueError(f"Unable to load verified CatBoost model: {error}") from error
    _validate_estimator_feature_names(model)
    return LoadedValuationBundle(directory, dict(metadata), uncertainty, model)


def validate_uncertainty_state(state: Mapping[str, object]) -> None:
    """Validate compact calibration state, including every persisted finite q."""
    if not isinstance(state, Mapping) or state.get("schema_version") != 1:
        raise ValueError("Unsupported uncertainty calibration schema version")
    expected_fields = {
        "method_name",
        "inference_method",
        "calibration_cutoff",
        "calibration_years",
        "grouping_variable",
        "minimum_group_support",
        "finite_sample_quantile_rule",
        "fallback_rule",
        "supported_coverage_levels",
        "default_coverage_level",
        "global",
        "towns",
    }
    missing = expected_fields.difference(state)
    if missing:
        raise ValueError("Uncertainty calibration is missing fields: " + ", ".join(sorted(missing)))
    if state["method_name"] != CALIBRATION_METHOD or state["inference_method"] != INFERENCE_UNCERTAINTY_METHOD:
        raise ValueError("Unsupported uncertainty calibration method")
    if state["calibration_cutoff"] != CALIBRATION_CUTOFF:
        raise ValueError(f"Uncertainty calibration cutoff must be {CALIBRATION_CUTOFF}")
    if state["calibration_years"] != list(CALIBRATION_YEARS):
        raise ValueError("Uncertainty calibration must contain exactly residual years 2021-2025")
    if state["grouping_variable"] != "town":
        raise ValueError("Uncertainty grouping variable must be town")
    if state["minimum_group_support"] != MIN_GROUP_CALIBRATION_SUPPORT:
        raise ValueError("Uncertainty minimum group support is invalid")
    if state["supported_coverage_levels"] != list(SUPPORTED_COVERAGE_LEVELS):
        raise ValueError("Uncertainty supported coverage levels are invalid")
    if state["default_coverage_level"] != DEFAULT_COVERAGE_LEVEL:
        raise ValueError("Uncertainty default coverage level is invalid")
    global_record = state["global"]
    towns = state["towns"]
    if not isinstance(global_record, Mapping) or not isinstance(towns, Mapping):
        raise ValueError("Uncertainty global and town records must be objects")
    _validate_threshold_record(global_record, minimum_support=1)
    for town, record in towns.items():
        if normalize_town(town) != town:
            raise ValueError("Persisted town keys must be canonical uppercase names")
        if not isinstance(record, Mapping):
            raise ValueError(f"Uncertainty record for {town} must be an object")
        _validate_threshold_record(record, minimum_support=MIN_GROUP_CALIBRATION_SUPPORT)


def _validate_threshold_record(record: Mapping[str, object], minimum_support: int) -> None:
    support = record.get("support_count")
    thresholds = record.get("thresholds")
    if not isinstance(support, int) or support < minimum_support:
        raise ValueError("Uncertainty calibration support count is invalid")
    if not isinstance(thresholds, Mapping) or set(thresholds) != {
        _coverage_key(level) for level in SUPPORTED_COVERAGE_LEVELS
    }:
        raise ValueError("Uncertainty threshold record must include 80%, 90%, and 95% q values")
    for q in thresholds.values():
        _finite_nonnegative(q, "conformal q")


def _validate_global_threshold_copy(
    metadata: Mapping[str, object], uncertainty: Mapping[str, object]
) -> None:
    global_record = uncertainty["global"]
    thresholds = global_record["thresholds"]
    copy = metadata["global_conformal_thresholds"]
    if not isinstance(copy, Mapping) or set(copy) != set(thresholds):
        raise ValueError("Metadata global conformal thresholds do not match uncertainty.json")
    for key, value in thresholds.items():
        if float(copy[key]) != float(value):
            raise ValueError("Metadata global conformal thresholds do not match uncertainty.json")


def _validate_manifest(manifest: Mapping[str, object]) -> None:
    if not isinstance(manifest, Mapping):
        raise ValueError("Bundle manifest must be a JSON object")
    if manifest.get("manifest_version") != 1 or manifest.get("hash_algorithm") != "sha256":
        raise ValueError("Unsupported bundle manifest version or hash algorithm")
    files = manifest.get("files")
    expected = {MODEL_FILENAME, UNCERTAINTY_FILENAME, METADATA_FILENAME}
    if not isinstance(files, Mapping) or set(files) != expected:
        raise ValueError("Bundle manifest must hash model, uncertainty, and metadata files")
    for filename, digest in files.items():
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError(f"Bundle manifest has an invalid SHA-256 digest for {filename}")


def _validate_estimator_feature_names(estimator: object) -> None:
    feature_names = getattr(estimator, "feature_names_", None)
    names = tuple(feature_names) if feature_names is not None else ()
    if names != BOOSTED_FEATURES:
        raise ValueError("CatBoost model feature names do not match the frozen feature order")


def _validate_prediction_features(features: Mapping[str, object]) -> dict[str, object]:
    if not isinstance(features, Mapping):
        raise ValueError("Prediction features must be a mapping with the exact feature contract")
    provided = set(features)
    expected = set(BOOSTED_FEATURES)
    if provided != expected:
        missing = sorted(expected - provided)
        unexpected = sorted(provided - expected)
        raise ValueError(
            f"Prediction features have missing or unexpected feature names; "
            f"missing={missing}, unexpected={unexpected}"
        )
    if tuple(features.keys()) != BOOSTED_FEATURES:
        raise ValueError("Prediction features must follow the exact frozen feature order")
    result: dict[str, object] = {}
    for column in NUMERIC_FEATURES:
        value = features[column]
        if isinstance(value, (bool, np.bool_)) or not isinstance(value, (int, float, np.number)):
            raise ValueError(f"Prediction numeric feature {column} must be finite numeric")
        number = float(value)
        if not math.isfinite(number):
            raise ValueError(f"Prediction numeric feature {column} must be finite numeric")
        result[column] = number
    year = result["transaction_year"]
    month = result["transaction_month"]
    if not year.is_integer() or not month.is_integer() or not 1 <= month <= 12:
        raise ValueError("transaction_year and transaction_month must be valid calendar integers")
    if result["floor_area_sqm"] <= 0 or result["remaining_lease_months"] < 0:
        raise ValueError("floor area must be positive and remaining lease must be non-negative")
    for column in CATEGORICAL_FEATURES:
        value = features[column]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Prediction categorical feature {column} must be a non-empty string")
        result[column] = normalize_town(value) if column == "town" else value
    return result


def _validate_versioned_values(metadata: Mapping[str, object]) -> None:
    dataset = metadata["dataset"]
    if dataset.get("resource_id") != "d_8b84c4ee58e3cfc0ece0d773c8ca6abc":
        raise ValueError("Bundle dataset resource identifier is invalid")
    versions = metadata["library_versions"]
    if any(not isinstance(versions.get(key), str) or not versions[key] for key in ("python", "catboost", "pandas", "numpy")):
        raise ValueError("Bundle library version metadata is incomplete")
    coverage = metadata["supported_coverage_levels"]
    if any(_coverage_key(level) not in {_coverage_key(item) for item in SUPPORTED_COVERAGE_LEVELS} for level in coverage):
        raise ValueError("Bundle contains an unsupported coverage level")


def _coverage_key(coverage: float) -> str:
    if isinstance(coverage, bool) or not isinstance(coverage, (int, float, np.number)):
        raise ValueError(UNSUPPORTED_COVERAGE_MESSAGE)
    value = float(coverage)
    if value not in SUPPORTED_COVERAGE_LEVELS:
        raise ValueError(UNSUPPORTED_COVERAGE_MESSAGE)
    return str(value)


def _finite_nonnegative(value: object, label: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} must be a finite non-negative number") from error
    if not math.isfinite(number) or number < 0:
        raise ValueError(f"{label} must be a finite non-negative number")
    return number


def _parse_cutoff(value: object, label: str) -> pd.Period:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
        raise ValueError(f"{label} must use YYYY-MM format")
    return pd.Period(value, freq="M")


def _parse_timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Bundle created_at must be a timezone-aware ISO timestamp")
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Bundle created_at must be a timezone-aware ISO timestamp") from error
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise ValueError("Bundle created_at must be a timezone-aware ISO timestamp")
    return timestamp


def _write_json(path: Path, value: Mapping[str, object]) -> None:
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def _read_json(path: Path, label: str) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Bundle {label} file is missing or malformed: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Bundle {label} must contain a JSON object")
    return value


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
