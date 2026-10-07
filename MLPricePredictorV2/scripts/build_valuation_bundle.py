"""Train and validate the immutable local CatBoost valuation bundle."""

import argparse
import gc
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from time import perf_counter

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.data.load import find_raw_csv, load_resale_data  # noqa: E402
from src.data.validate import validate_required_columns  # noqa: E402
from src.evaluation.robustness import evaluate_frozen_catboost_year  # noqa: E402
from src.inference.bundle import (  # noqa: E402
    CALIBRATION_CUTOFF,
    CALIBRATION_YEARS,
    DEFAULT_MODEL_VERSION,
    MANIFEST_FILENAME,
    METADATA_FILENAME,
    MODEL_FILENAME,
    REQUIRED_BUNDLE_FILES,
    SUPPORTED_COVERAGE_LEVELS,
    UNCERTAINTY_FILENAME,
    OutOfSamplePredictionFold,
    build_calibration_residuals,
    build_uncertainty_state,
    create_bundle_metadata,
    get_uncertainty_threshold,
    load_bundle,
    write_bundle,
)
from src.models.boosted import (  # noqa: E402
    BOOSTED_FEATURES,
    FROZEN_CATBOOST_CONFIG,
    FROZEN_CATBOOST_ITERATIONS,
    ComputeDevice,
    detect_gpu_devices,
    fit_frozen_catboost,
    prepare_catboost_features,
    verify_gpu_libraries,
)
from src.preprocessing.base import prepare_features  # noqa: E402

ARTIFACT_ROOT = PROJECT_ROOT / "artifacts"
BUNDLE_ROOT = ARTIFACT_ROOT / DEFAULT_MODEL_VERSION
DEFAULT_RAW_RETRIEVAL_DATE = "2026-10-04"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--device",
        choices=("gpu", "cpu"),
        default="gpu",
        help="GPU is required by default; CPU must be selected explicitly.",
    )
    return parser.parse_args()


def _history_only(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.PeriodIndex]:
    """Validate source months and select rows before extracting any target slice."""
    parsed = []
    for index, value in raw["month"].items():
        if (
            not isinstance(value, str)
            or not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value)
        ):
            raise ValueError(f"Invalid month at source index {index!r}: {value!r}")
        parsed.append(pd.Period(value, freq="M"))
    periods = pd.PeriodIndex(parsed, freq="M")
    if periods.isna().any():
        raise ValueError("Source transaction months must not be missing")
    cutoff = pd.Period(CALIBRATION_CUTOFF, freq="M")
    historical_mask = periods <= cutoff
    history = raw.loc[historical_mask].copy()
    if history.empty or periods[historical_mask].max() != cutoff:
        raise ValueError(f"Raw dataset must contain training data through {CALIBRATION_CUTOFF}")
    return history, periods


def _dataset_coverage(periods: pd.PeriodIndex) -> tuple[str, str]:
    if len(periods) == 0:
        raise ValueError("Raw dataset has no transaction months")
    return str(periods.min()), str(periods.max())


def _run_gpu_preflight(device: ComputeDevice) -> None:
    devices = detect_gpu_devices()
    print(f"Requested device: {device}; NVIDIA GPU detected: {bool(devices)}")
    if device == "gpu":
        try:
            status = verify_gpu_libraries()
        except (RuntimeError, OSError) as error:
            raise SystemExit(
                f"GPU preflight failed; no CPU fallback was attempted: {error}"
            ) from error
        print(
            f"GPU preflight passed: device {status['device'].index}, "
            f"{status['device'].name}; CatBoost {status['catboost_version']}; "
            f"XGBoost {status['xgboost_version']} smoke fit passed"
        )
    elif devices:
        print(f"Explicit CPU mode selected; detected GPU: {devices[0].name}")
    else:
        print("Explicit CPU mode selected; no NVIDIA GPU is required.")


def _validate_round_trip(
    staging_bundle: Path,
    estimator,
    uncertainty: dict[str, object],
    representative: pd.DataFrame,
) -> None:
    prepared = prepare_catboost_features(representative.loc[:, BOOSTED_FEATURES])
    original_predictions = np.asarray(estimator.predict(prepared), dtype=float)
    expected_thresholds = {
        (town, level): get_uncertainty_threshold(uncertainty, town, level).q_sgd
        for town in ["GLOBAL", *uncertainty["towns"].keys()]
        for level in SUPPORTED_COVERAGE_LEVELS
    }
    del estimator
    gc.collect()
    loaded = load_bundle(staging_bundle)
    loaded_predictions = np.asarray(
        loaded.model.predict(prepare_catboost_features(representative.loc[:, BOOSTED_FEATURES])),
        dtype=float,
    )
    np.testing.assert_allclose(
        loaded_predictions,
        original_predictions,
        rtol=1e-12,
        atol=1e-8,
    )
    for (town, level), expected_q in expected_thresholds.items():
        loaded_q = loaded.get_uncertainty_threshold(town, level).q_sgd
        if loaded_q != expected_q:
            raise AssertionError(
                f"Threshold round-trip mismatch for {town} at {level:.0%}: "
                f"{expected_q} != {loaded_q}"
            )
    for (_, row), predicted in zip(representative.iterrows(), loaded_predictions):
        result = loaded.predict_one(row.loc[list(BOOSTED_FEATURES)].to_dict())
        if abs(result.estimated_value - float(predicted)) > 1e-8:
            raise AssertionError("Loaded prediction helper differs from model round-trip output")
        if result.interval_full_width != 2 * result.interval_half_width:
            raise AssertionError("Loaded uncertainty interval width is inconsistent")


def _report_thresholds(bundle_directory: Path, uncertainty: dict[str, object]) -> None:
    print("\nGLOBAL CONFORMAL THRESHOLDS")
    global_record = uncertainty["global"]
    for level in SUPPORTED_COVERAGE_LEVELS:
        q = float(global_record["thresholds"][str(level)])
        print(f"  {level:.0%}: q=${q:,.0f}; full width=${2 * q:,.0f}")

    town_rows = []
    for town, record in sorted(uncertainty["towns"].items()):
        q = float(record["thresholds"]["0.9"])
        town_rows.append((town, int(record["support_count"]), q, False))
    print("\nTOWN-SPECIFIC 90% THRESHOLDS (ELIGIBLE GROUPS)")
    print("town | support | q / plus-minus SGD | full width SGD | global fallback")
    for town, support, q, fallback in town_rows:
        print(f"{town} | {support:,} | ${q:,.0f} | ${2*q:,.0f} | {fallback}")
    if town_rows:
        qs = np.asarray([row[2] for row in town_rows], dtype=float)
        widths = 2 * qs
        narrow_index = int(np.argmin(qs))
        wide_index = int(np.argmax(qs))
        print(
            "90% town q summary (eligible towns): "
            f"min=${qs.min():,.0f}; max=${qs.max():,.0f}; "
            f"median=${np.median(qs):,.0f}; mean=${qs.mean():,.0f}"
        )
        print(
            "90% town full-width summary: "
            f"min=${widths.min():,.0f}; max=${widths.max():,.0f}; "
            f"median=${np.median(widths):,.0f}; mean=${widths.mean():,.0f}"
        )
        print(
            f"Narrowest={town_rows[narrow_index][0]} (${qs[narrow_index]:,.0f} q); "
            f"widest={town_rows[wide_index][0]} (${qs[wide_index]:,.0f} q)"
        )
    print(f"Threshold source file: {bundle_directory / UNCERTAINTY_FILENAME}")


def _report_sizes(bundle_directory: Path) -> None:
    sizes = {
        filename: (bundle_directory / filename).stat().st_size
        for filename in REQUIRED_BUNDLE_FILES
    }
    print("\nBUNDLE FILE SIZES")
    for filename, size in sizes.items():
        print(f"  {filename}: {size:,} bytes ({size / 1024**2:.2f} MiB)")
    total = sum(sizes.values())
    print(f"  total: {total:,} bytes ({total / 1024**2:.2f} MiB)")


def main() -> None:
    args = _parse_args()
    device: ComputeDevice = args.device
    started = perf_counter()
    if BUNDLE_ROOT.exists():
        raise SystemExit(
            f"Immutable bundle already exists: {BUNDLE_ROOT}. "
            "Create a new semantic version rather than overwriting it."
        )
    _run_gpu_preflight(device)

    import catboost

    raw_path = find_raw_csv()
    raw = load_resale_data(raw_path)
    validate_required_columns(raw)
    historical_raw, all_periods = _history_only(raw)
    prepared = prepare_features(historical_raw)
    periods = prepared.transaction_period
    if periods.max() != pd.Period(CALIBRATION_CUTOFF, freq="M"):
        raise AssertionError("Prepared historical data crossed or missed the training cutoff")
    if (periods >= pd.Period("2026-01", freq="M")).any():
        raise AssertionError("2026 rows must not enter model training or calibration")
    print(
        f"Dataset={raw_path.name}; rows loaded={len(raw):,}; "
        f"historical rows prepared={len(prepared.features):,}; "
        f"source coverage={_dataset_coverage(all_periods)[0]} to {_dataset_coverage(all_periods)[1]}"
    )
    print(
        f"Model version={DEFAULT_MODEL_VERSION}; training cutoff={CALIBRATION_CUTOFF}; "
        f"CatBoost={catboost.__version__}; pandas={pd.__version__}; NumPy={np.__version__}"
    )
    print(
        f"Frozen CatBoost: depth={FROZEN_CATBOOST_CONFIG.depth}, "
        f"learning_rate={FROZEN_CATBOOST_CONFIG.learning_rate}, "
        f"iterations={FROZEN_CATBOOST_ITERATIONS}; features={', '.join(BOOSTED_FEATURES)}"
    )

    folds = []
    for year in CALIBRATION_YEARS:
        result = evaluate_frozen_catboost_year(
            prepared.features,
            prepared.target,
            periods,
            year,
            device=device,
            calculate_metrics=False,
        )
        if result.training.transaction_period.max() >= pd.Period(f"{year}-01", freq="M"):
            raise AssertionError(f"Calibration model for {year} used same-year or future training data")
        folds.append(
            OutOfSamplePredictionFold(
                year=year,
                features=result.evaluation.features,
                predictions=result.predictions,
            )
        )
        print(
            f"Residual source {year}: train={len(result.training.features):,} "
            f"through {year - 1}-12; out-of-sample rows={len(result.evaluation.features):,}; "
            f"fit={result.fit_seconds:.2f}s; predict={result.prediction_seconds:.2f}s"
        )
    residuals = build_calibration_residuals(folds, prepared.target)
    uncertainty = build_uncertainty_state(residuals, CALIBRATION_CUTOFF)
    if residuals["year"].max() > 2025:
        raise AssertionError("2026 residuals cannot enter the persisted calibration")

    training_features = prepared.features.loc[:, BOOSTED_FEATURES]
    training_target = prepared.target.reindex(training_features.index)
    if training_features.index.has_duplicates or not training_features.index.equals(training_target.index):
        raise AssertionError("Training feature and target indices must be unique and aligned")
    print(
        f"Final model fit: {len(training_features):,} rows through {CALIBRATION_CUTOFF}; "
        f"calibration rows={len(residuals):,}; eligible towns={len(uncertainty['towns'])}"
    )
    fit_started = perf_counter()
    fitted = fit_frozen_catboost(training_features, training_target, device=device)
    fit_seconds = perf_counter() - fit_started
    print(f"Final model fit time: {fit_seconds:.2f}s")

    source_coverage = _dataset_coverage(all_periods)
    metadata = create_bundle_metadata(
        training_row_count=len(training_features),
        training_device=device,
        source_dataset_coverage=source_coverage,
        uncertainty_state=uncertainty,
    )
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    staging_parent = Path(tempfile.mkdtemp(prefix=".valuation-bundle-stage-", dir=ARTIFACT_ROOT))
    staging_bundle = staging_parent / DEFAULT_MODEL_VERSION
    try:
        write_bundle(staging_bundle, fitted.estimator, metadata, uncertainty)
        sample = training_features.head(8).copy()
        _validate_round_trip(staging_bundle, fitted.estimator, uncertainty, sample)
        del fitted
        gc.collect()
        if BUNDLE_ROOT.exists():
            raise FileExistsError(f"Immutable bundle already exists: {BUNDLE_ROOT}")
        os.rename(staging_bundle, BUNDLE_ROOT)
        loaded = load_bundle(BUNDLE_ROOT)
        print("Bundle loader and SHA-256 integrity verification: PASS")
        print(
            f"Published local bundle: {BUNDLE_ROOT}; model={loaded.model_version}; "
            f"training cutoff={metadata['training_cutoff']}; "
            f"calibration cutoff={metadata['calibration_cutoff']}"
        )
        print(f"Supported coverage={metadata['supported_coverage_levels']}; default=90%")
        _report_thresholds(BUNDLE_ROOT, loaded.uncertainty)
        _report_sizes(BUNDLE_ROOT)
        print(
            f"Python={metadata['library_versions']['python']}; CatBoost={catboost.__version__}; "
            f"pandas={pd.__version__}; NumPy={np.__version__}; device={device}"
        )
        print(f"Bundle build runtime: {perf_counter() - started:.2f}s")
    finally:
        shutil.rmtree(staging_parent, ignore_errors=True)


if __name__ == "__main__":
    main()
