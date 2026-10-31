"""Persisted-artifact safety and CSV-loading contracts with synthetic data.

These white-box validation fault cases complement black-box public loader,
immutability and HTTP tests. Every temporary file is a synthetic fixture.
"""

from copy import deepcopy

import pandas as pd
import pytest

from src.data.load import find_raw_csv, load_resale_data
from src.inference.bundle import (
    DEFAULT_MODEL_VERSION,
    LoadedValuationBundle,
    load_bundle,
    validate_metadata,
    validate_uncertainty_state,
    write_bundle,
)
from src.models.boosted import BOOSTED_FEATURES
from test_valuation_bundle import bundle_metadata, calibration_state, features


@pytest.mark.parametrize(
    "field,value,message",
    [
        ("bundle_format_version", 99, "Unsupported bundle format"),
        ("model_family", "unreviewed_model", "CatBoost"),
        ("model_filename", "other.cbm", "CatBoost"),
        ("model_serialization_format", "pickle", "serialization"),
        ("model_version", "../other-model", "Invalid model version"),
        ("training_cutoff", "2026-01", "training cutoff"),
        ("calibration_cutoff", "2026-01", "calibration cutoff"),
        ("feature_schema_version", "unknown-v99", "feature schema"),
        ("numeric_features", ["resale_price"], "numeric feature"),
        ("categorical_features", ["income"], "categorical feature"),
        ("target_name", "asking_price", "Target"),
        ("random_seed", 0, "seed or iteration"),
        ("iteration_count", 1, "seed or iteration"),
        ("catboost_parameters", [], "parameters must be an object"),
        ("catboost_parameters", {"depth": 1}, "frozen model configuration"),
        ("training_row_count", 0, "positive integer"),
        ("minimum_group_support", 1, "minimum group support"),
        ("supported_coverage_levels", [0.99], "coverage levels"),
        ("default_coverage_level", 0.8, "default coverage"),
        ("uncertainty_method", "unknown", "uncertainty method"),
        ("grouping_variable", "income", "grouping variable"),
        ("dataset", [], "must be an object"),
        ("library_versions", [], "must be an object"),
        ("known_limitations", [], "non-empty list"),
        ("created_at", "2026-10-08T12:00:00", "timezone-aware"),
        ("created_at", "invalid timestamp", "timezone-aware"),
    ],
)
def test_bundle_metadata_rejects_incompatible_frozen_contract(field, value, message):
    metadata = bundle_metadata(calibration_state())
    metadata[field] = value
    with pytest.raises(ValueError, match=message):
        validate_metadata(metadata)


def test_bundle_metadata_requires_source_provenance_and_runtime_version_metadata():
    metadata = bundle_metadata(calibration_state())
    bad_provenance = deepcopy(metadata)
    bad_provenance["dataset"]["resource_id"] = "unverified-source"
    with pytest.raises(ValueError, match="resource identifier"):
        validate_metadata(bad_provenance)
    bad_versions = deepcopy(metadata)
    bad_versions["library_versions"].pop("catboost")
    with pytest.raises(ValueError, match="version metadata is incomplete"):
        validate_metadata(bad_versions)
    missing = deepcopy(metadata)
    missing.pop("training_cutoff")
    with pytest.raises(ValueError, match="missing required fields.*training_cutoff"):
        validate_metadata(missing)


@pytest.mark.parametrize(
    "field,value,message",
    [
        ("schema_version", 99, "schema version"),
        ("method_name", "unknown", "calibration method"),
        ("calibration_cutoff", "2026-01", "cutoff"),
        ("calibration_years", [2021, 2022, 2023, 2024, 2026], "2021-2025"),
        ("grouping_variable", "income", "grouping variable"),
        ("minimum_group_support", 1, "minimum group support"),
        ("supported_coverage_levels", [0.99], "coverage levels"),
        ("default_coverage_level", 0.8, "default coverage"),
        ("global", [], "records must be objects"),
        ("towns", [], "records must be objects"),
    ],
)
def test_uncertainty_state_rejects_changed_calibration_policy(field, value, message):
    state = calibration_state()
    state[field] = value
    with pytest.raises(ValueError, match=message):
        validate_uncertainty_state(state)


@pytest.mark.parametrize("bad_q", [-1, float("nan"), float("inf"), "invalid"])
def test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius(bad_q):
    state = calibration_state()
    state["global"]["thresholds"]["0.9"] = bad_q
    with pytest.raises(ValueError, match="finite non-negative"):
        validate_uncertainty_state(state)


def test_uncertainty_state_requires_all_coverages_and_sufficient_town_support():
    state = calibration_state()
    state["global"]["thresholds"].pop("0.95")
    with pytest.raises(ValueError, match="80%, 90%, and 95%"):
        validate_uncertainty_state(state)
    state = calibration_state()
    state["towns"]["A TOWN"]["support_count"] = 29
    with pytest.raises(ValueError, match="support count"):
        validate_uncertainty_state(state)


def test_uncertainty_state_requires_canonical_town_keys_and_object_records():
    state = calibration_state()
    state["towns"]["a town"] = state["towns"].pop("A TOWN")
    with pytest.raises(ValueError, match="canonical uppercase"):
        validate_uncertainty_state(state)
    state = calibration_state()
    state["towns"]["A TOWN"] = []
    with pytest.raises(ValueError, match="must be an object"):
        validate_uncertainty_state(state)


def test_bundle_write_failure_removes_partial_artifact_directory(tmp_path):
    class FailingSyntheticEstimator:
        feature_names_ = BOOSTED_FEATURES

        def save_model(self, path, format):
            assert format == "cbm"
            from pathlib import Path

            Path(path).write_bytes(b"synthetic-incomplete-model")
            raise OSError("synthetic-disk-failure")

    state = calibration_state()
    destination = tmp_path / DEFAULT_MODEL_VERSION
    with pytest.raises(OSError, match="synthetic-disk-failure"):
        write_bundle(destination, FailingSyntheticEstimator(), bundle_metadata(state), state)
    assert not destination.exists()


@pytest.mark.parametrize("manifest", ["not JSON", "[]", '{"manifest_version":99,"hash_algorithm":"sha256"}', '{"manifest_version":1,"hash_algorithm":"sha256","files":{}}'])
def test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading(tmp_path, manifest):
    for name in ["model.cbm", "metadata.json", "uncertainty.json"]:
        (tmp_path / name).write_text("synthetic fixture", encoding="utf-8")
    (tmp_path / "manifest.json").write_text(manifest, encoding="utf-8")
    with pytest.raises(ValueError, match="manifest"):
        load_bundle(tmp_path)


@pytest.mark.parametrize("returned_value", [float("nan"), float("inf")])
def test_direct_bundle_prediction_rejects_non_finite_model_outputs(tmp_path, returned_value):
    class SyntheticEstimator:
        def predict(self, prepared):
            return [returned_value]

    state = calibration_state()
    loaded = LoadedValuationBundle(tmp_path, bundle_metadata(state), state, SyntheticEstimator())
    with pytest.raises(ValueError, match="non-finite valuation"):
        loaded.predict_one(features(1).iloc[0].to_dict())


def test_csv_discovery_requires_exactly_one_source_file(tmp_path):
    with pytest.raises(FileNotFoundError, match="No CSV files"):
        find_raw_csv(tmp_path)
    first = tmp_path / "synthetic-a.csv"
    first.write_text("town,resale_price\nSYNTHETIC TOWN,123\n", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("not a CSV", encoding="utf-8")
    assert find_raw_csv(tmp_path) == first
    (tmp_path / "synthetic-b.csv").write_text("town,resale_price\n", encoding="utf-8")
    with pytest.raises(ValueError, match="Expected one raw CSV.*synthetic-a.csv, synthetic-b.csv"):
        find_raw_csv(tmp_path)


def test_explicit_csv_load_preserves_source_rows_and_does_not_modify_file(tmp_path):
    source = tmp_path / "synthetic.csv"
    content = b"town,resale_price\nSYNTHETIC TOWN,123\nSYNTHETIC TOWN,123\n"
    source.write_bytes(content)
    loaded = load_resale_data(source)
    assert loaded.to_dict(orient="list") == {"town": ["SYNTHETIC TOWN", "SYNTHETIC TOWN"], "resale_price": [123, 123]}
    assert source.read_bytes() == content
    pd.testing.assert_frame_equal(loaded, pd.read_csv(source))
