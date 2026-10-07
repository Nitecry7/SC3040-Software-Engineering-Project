import hashlib
import json

import numpy as np
import pandas as pd
import pytest
from catboost import CatBoostRegressor

from src.evaluation.uncertainty import COVERAGE_LEVELS
from src.inference.bundle import (
    BUNDLE_FORMAT_VERSION,
    DEFAULT_COVERAGE_LEVEL,
    DEFAULT_MODEL_VERSION,
    FEATURE_SCHEMA_VERSION,
    MODEL_FILENAME,
    SUPPORTED_COVERAGE_LEVELS,
    UNSUPPORTED_COVERAGE_MESSAGE,
    OutOfSamplePredictionFold,
    build_calibration_residuals,
    build_uncertainty_state,
    create_bundle_metadata,
    get_uncertainty_threshold,
    load_bundle,
    normalize_town,
    validate_metadata,
    write_bundle,
)
from src.models.boosted import BOOSTED_FEATURES, CATEGORICAL_FEATURES, NUMERIC_FEATURES


def residual_history():
    rows = []
    index = 0
    for year in range(2021, 2026):
        for residual in range(1, 11):
            rows.append(
                {
                    "year": year,
                    "town": "A TOWN",
                    "flat_type": "3 ROOM",
                    "residual_sgd": float(residual + year - 2021),
                }
            )
            index += 1
        for residual in range(1, 3):
            rows.append(
                {
                    "year": year,
                    "town": "B TOWN",
                    "flat_type": "4 ROOM",
                    "residual_sgd": float(residual + year - 2021),
                }
            )
            index += 1
    return pd.DataFrame(rows, index=range(index))


def features(rows=40):
    values = {
        "transaction_year": [2025] * rows,
        "transaction_month": [1 + index % 12 for index in range(rows)],
        "floor_area_sqm": [90.0 + index % 4 for index in range(rows)],
        "storey_mid": [5.0 + index % 6 for index in range(rows)],
        "remaining_lease_months": [650.0 - index for index in range(rows)],
        "town": ["A TOWN" if index % 2 == 0 else "B TOWN" for index in range(rows)],
        "flat_type": ["3 ROOM" if index % 2 == 0 else "4 ROOM" for index in range(rows)],
        "block": [str(index % 5) for index in range(rows)],
        "street_name": [f"ROAD {index % 3}" for index in range(rows)],
        "flat_model": ["Model A" if index % 2 == 0 else "Model B" for index in range(rows)],
    }
    return pd.DataFrame(values, columns=BOOSTED_FEATURES)


def fitted_tiny_model():
    X = features()
    y = pd.Series(300_000 + X["floor_area_sqm"] * 900 + X["storey_mid"] * 200)
    model = CatBoostRegressor(
        iterations=3,
        depth=2,
        learning_rate=0.1,
        loss_function="RMSE",
        random_seed=42,
        allow_writing_files=False,
        verbose=False,
        thread_count=1,
    )
    model.fit(X, y, cat_features=list(CATEGORICAL_FEATURES), verbose=False)
    return model


def calibration_state():
    return build_uncertainty_state(residual_history(), "2025-12")


def bundle_metadata(state):
    return create_bundle_metadata(
        training_row_count=222_067,
        training_device="cpu",
        source_dataset_coverage=("2017-01", "2026-10"),
        uncertainty_state=state,
        created_at="2026-10-08T12:00:00Z",
    )


def save_test_bundle(tmp_path):
    state = calibration_state()
    bundle_dir = tmp_path / DEFAULT_MODEL_VERSION
    write_bundle(bundle_dir, fitted_tiny_model(), bundle_metadata(state), state)
    return bundle_dir


def test_calibration_persists_only_precomputed_supported_thresholds():
    state = calibration_state()
    assert state["supported_coverage_levels"] == list(COVERAGE_LEVELS)
    assert state["global"]["support_count"] == 60
    assert state["towns"]["A TOWN"]["support_count"] == 50
    assert "B TOWN" not in state["towns"]
    assert set(state["global"]["thresholds"]) == {"0.8", "0.9", "0.95"}
    assert all(
        set(group["thresholds"]) == {"0.8", "0.9", "0.95"}
        for group in state["towns"].values()
    )
    assert "residual_sgd" not in json.dumps(state)
    assert "actual" not in json.dumps(state)


def test_calibration_rejects_residuals_after_cutoff():
    future = pd.concat(
        [residual_history(), pd.DataFrame([{
            "year": 2026,
            "town": "A TOWN",
            "flat_type": "3 ROOM",
            "residual_sgd": 1.0,
        }])],
        ignore_index=True,
    )
    with pytest.raises(ValueError, match="after calibration cutoff"):
        build_uncertainty_state(future, "2025-12")


def test_future_target_mutation_does_not_change_bundle_calibration():
    folds = []
    targets = {}
    for year in range(2021, 2026):
        index = year
        folds.append(
            OutOfSamplePredictionFold(
                year=year,
                features=pd.DataFrame(
                    {"town": ["A TOWN"], "flat_type": ["3 ROOM"]}, index=[index]
                ),
                predictions=pd.Series([100.0], index=[index]),
            )
        )
        targets[index] = 100.0 + year
    targets[2026] = 999_999_999.0
    actual = pd.Series(targets)

    first = build_uncertainty_state(
        build_calibration_residuals(folds, actual), "2025-12"
    )
    changed = actual.copy()
    changed.loc[2026] = -999_999_999.0
    second = build_uncertainty_state(
        build_calibration_residuals(folds, changed), "2025-12"
    )
    assert first == second


def test_future_year_fold_is_rejected_for_calibration():
    folds = [
        OutOfSamplePredictionFold(
            year=year,
            features=pd.DataFrame({"town": ["A"], "flat_type": ["3 ROOM"]}, index=[year]),
            predictions=pd.Series([10.0], index=[year]),
        )
        for year in range(2021, 2027)
    ]
    with pytest.raises(ValueError, match="must not exceed 2025"):
        build_calibration_residuals(folds, pd.Series({year: 20.0 for year in range(2021, 2027)}))


def test_town_lookup_normalizes_whitespace_and_case_with_global_fallback():
    state = calibration_state()
    known = get_uncertainty_threshold(state, "  a town ", 0.90)
    assert known.town == "A TOWN"
    assert known.support_count == 50
    assert known.used_global_fallback is False
    assert known.q_sgd == state["towns"]["A TOWN"]["thresholds"]["0.9"]

    undersupported = get_uncertainty_threshold(state, "B TOWN", 0.90)
    unseen = get_uncertainty_threshold(state, "NEW TOWN", 0.90)
    assert undersupported.used_global_fallback is True
    assert unseen.used_global_fallback is True
    assert undersupported.q_sgd == unseen.q_sgd == state["global"]["thresholds"]["0.9"]
    assert undersupported.support_count == unseen.support_count == 60


@pytest.mark.parametrize("coverage", [0.80, 0.90, 0.95])
def test_all_supported_coverages_return_half_and_full_width(coverage):
    state = calibration_state()
    threshold = get_uncertainty_threshold(state, "A TOWN", coverage)
    assert threshold.q_sgd > 0
    assert threshold.full_width_sgd == 2 * threshold.q_sgd


def test_unsupported_coverage_is_rejected():
    with pytest.raises(ValueError, match=UNSUPPORTED_COVERAGE_MESSAGE):
        get_uncertainty_threshold(calibration_state(), "A TOWN", 0.85)


def test_feature_and_bundle_metadata_contract_rejects_changes():
    metadata = bundle_metadata(calibration_state())
    validate_metadata(metadata)
    assert metadata["bundle_format_version"] == BUNDLE_FORMAT_VERSION == 1
    assert metadata["feature_schema_version"] == FEATURE_SCHEMA_VERSION
    assert metadata["default_coverage_level"] == DEFAULT_COVERAGE_LEVEL == 0.90
    assert metadata["numeric_features"] == list(NUMERIC_FEATURES)
    assert metadata["categorical_features"] == list(CATEGORICAL_FEATURES)
    assert "resale_price" not in metadata["feature_order"]

    wrong_version = dict(metadata, bundle_format_version=999)
    with pytest.raises(ValueError, match="Unsupported bundle format"):
        validate_metadata(wrong_version)
    wrong_order = dict(metadata, feature_order=list(reversed(BOOSTED_FEATURES)))
    with pytest.raises(ValueError, match="feature order"):
        validate_metadata(wrong_order)
    missing_schema = dict(metadata)
    missing_schema.pop("feature_schema_version")
    with pytest.raises(ValueError, match="metadata is missing"):
        validate_metadata(missing_schema)


def test_metadata_rejects_invalid_cutoffs_and_version():
    metadata = bundle_metadata(calibration_state())
    with pytest.raises(ValueError, match="training cutoff"):
        validate_metadata(dict(metadata, training_cutoff="2026-01"))
    with pytest.raises(ValueError, match="calibration cutoff"):
        validate_metadata(dict(metadata, calibration_cutoff="2026-01"))
    with pytest.raises(ValueError, match="model version"):
        validate_metadata(dict(metadata, model_version="../../bad"))


def test_bundle_save_load_prediction_shape_and_threshold_round_trip(tmp_path):
    state = calibration_state()
    model = fitted_tiny_model()
    metadata = bundle_metadata(state)
    sample = features(4).iloc[:2].copy()
    original_points = model.predict(sample)
    original_q = {
        (town, level): get_uncertainty_threshold(state, town, level).q_sgd
        for town in ("A TOWN", "UNKNOWN TOWN")
        for level in SUPPORTED_COVERAGE_LEVELS
    }

    bundle_dir = tmp_path / DEFAULT_MODEL_VERSION
    write_bundle(bundle_dir, model, metadata, state)
    loaded = load_bundle(bundle_dir)
    prediction = loaded.predict_one(sample.iloc[0].to_dict(), coverage=0.90)

    np.testing.assert_allclose(loaded.model.predict(sample), original_points, rtol=1e-12, atol=1e-8)
    assert prediction.estimated_value == pytest.approx(original_points[0], abs=1e-8)
    assert prediction.lower_bound == prediction.estimated_value - prediction.interval_half_width
    assert prediction.upper_bound == prediction.estimated_value + prediction.interval_half_width
    assert prediction.interval_full_width == 2 * prediction.interval_half_width
    assert prediction.model_version == DEFAULT_MODEL_VERSION
    assert prediction.uncertainty_method == "town_conformal"
    assert prediction.used_global_fallback is False
    assert tuple(sample.columns) == BOOSTED_FEATURES

    for (town, level), expected in original_q.items():
        assert loaded.get_uncertainty_threshold(town, level).q_sgd == expected


def test_prediction_requires_exact_feature_names_and_valid_values(tmp_path):
    bundle_dir = save_test_bundle(tmp_path)
    loaded = load_bundle(bundle_dir)
    row = features(1).iloc[0].to_dict()
    with pytest.raises(ValueError, match="missing or unexpected feature"):
        loaded.predict_one({key: value for key, value in row.items() if key != BOOSTED_FEATURES[0]})
    reordered = dict(reversed(list(row.items())))
    with pytest.raises(ValueError, match="exact frozen feature order"):
        loaded.predict_one(reordered)
    row["resale_price"] = 500_000
    with pytest.raises(ValueError, match="missing or unexpected feature"):
        loaded.predict_one(row)
    row.pop("resale_price")
    row["floor_area_sqm"] = float("nan")
    with pytest.raises(ValueError, match="finite numeric"):
        loaded.predict_one(row)
    row = features(1).iloc[0].to_dict()
    row["town"] = None
    with pytest.raises(ValueError, match="categorical feature"):
        loaded.predict_one(row)


def test_loader_rejects_missing_files_and_invalid_manifest_hashes(tmp_path):
    bundle_dir = save_test_bundle(tmp_path)
    (bundle_dir / MODEL_FILENAME).unlink()
    with pytest.raises(ValueError, match="missing required bundle files"):
        load_bundle(bundle_dir)

    bundle_dir = save_test_bundle(tmp_path / "second")
    uncertainty_path = bundle_dir / "uncertainty.json"
    uncertainty_path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="checksum mismatch.*uncertainty.json"):
        load_bundle(bundle_dir)


@pytest.mark.parametrize("filename", ["model.cbm", "uncertainty.json", "metadata.json"])
def test_loader_checks_each_bundle_file_digest(tmp_path, filename):
    bundle_dir = save_test_bundle(tmp_path)
    path = bundle_dir / filename
    path.write_bytes(path.read_bytes() + b" ")
    with pytest.raises(ValueError, match=f"checksum mismatch.*{filename}"):
        load_bundle(bundle_dir)


def test_loader_rejects_metadata_even_when_manifest_matches(tmp_path):
    bundle_dir = save_test_bundle(tmp_path)
    metadata_path = bundle_dir / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["feature_order"] = list(reversed(BOOSTED_FEATURES))
    metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
    manifest_path = bundle_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["files"]["metadata.json"] = hashlib.sha256(metadata_path.read_bytes()).hexdigest()
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="feature order"):
        load_bundle(bundle_dir)


def test_bundle_version_is_immutable_and_not_overwritten(tmp_path):
    bundle_dir = save_test_bundle(tmp_path)
    original_hash = hashlib.sha256((bundle_dir / MODEL_FILENAME).read_bytes()).hexdigest()
    with pytest.raises(FileExistsError, match="immutable bundle version"):
        write_bundle(bundle_dir, fitted_tiny_model(), bundle_metadata(calibration_state()), calibration_state())
    assert hashlib.sha256((bundle_dir / MODEL_FILENAME).read_bytes()).hexdigest() == original_hash


def test_town_normalization_matches_backend_canonical_form():
    assert normalize_town("  Kallang/Whampoa ") == "KALLANG/WHAMPOA"
    with pytest.raises(ValueError, match="town must be a non-empty string"):
        normalize_town("  ")
