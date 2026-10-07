"""Prepare and report leakage-safe in-memory chronological partitions."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.data.load import find_raw_csv, load_resale_data  # noqa: E402
from src.data.validate import validate_required_columns  # noqa: E402
from src.preprocessing.base import prepare_features  # noqa: E402
from src.splitting.chronological import split_chronologically  # noqa: E402


def _report_iqr(data, column: str) -> None:
    values = data[column]
    q1, q3 = values.quantile([0.25, 0.75])
    spread = q3 - q1
    lower, upper = q1 - 1.5 * spread, q3 + 1.5 * spread
    flagged = ((values < lower) | (values > upper)).sum()
    print(
        f"IQR screening {column}: lower fence={lower:.2f}, upper fence={upper:.2f}, "
        f"flagged={flagged:,} (reported only; no rows removed)"
    )


def _report_partition(name, partition) -> None:
    periods = partition.transaction_period
    date_range = "empty" if periods.empty else f"{periods.min()} to {periods.max()}"
    print(
        f"{name}: rows={len(partition.features):,}, X shape={partition.features.shape}, "
        f"y shape={partition.target.shape}, month range={date_range}"
    )


def main() -> None:
    path = find_raw_csv()
    raw = load_resale_data(path)
    validate_required_columns(raw)
    prepared = prepare_features(raw)
    partitions = split_chronologically(
        prepared.features, prepared.target, prepared.transaction_period
    )

    print(f"Dataset file: {path.name}")
    print(f"Source rows: {len(raw):,}; source columns: {len(raw.columns)}")
    print(f"Exact duplicate rows: {raw.duplicated().sum():,} (preserved)")
    _report_iqr(raw, "resale_price")
    _report_iqr(raw, "floor_area_sqm")
    print(f"Features ({len(prepared.features.columns)}): {', '.join(prepared.features.columns)}")
    _report_partition("Train", partitions.train)
    _report_partition("Validation", partitions.validation)
    _report_partition("Test", partitions.test)
    _report_partition("Current partial/future period", partitions.current_partial_period)


if __name__ == "__main__":
    main()
