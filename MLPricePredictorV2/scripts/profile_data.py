"""Print a reproducible profile of the local raw HDB resale CSV."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.data.load import find_raw_csv, load_resale_data  # noqa: E402
from src.data.validate import validate_required_columns  # noqa: E402


def main() -> None:
    path = find_raw_csv()
    data = load_resale_data(path)
    validate_required_columns(data)

    print(f"Dataset file: {path.name}")
    print(f"Row count: {len(data):,}")
    print(f"Column count: {len(data.columns)}")
    print("Columns and data types:")
    for column, dtype in data.dtypes.items():
        print(f"  {column}: {dtype}")
    print("Missing values:")
    for column, count in data.isna().sum().items():
        print(f"  {column}: {count:,}")
    print(f"Duplicate rows: {data.duplicated().sum():,}")

    months = data["month"].dropna().astype(str)
    print(f"Transaction month range: {months.min()} to {months.max()}")
    for column in ("town", "flat_type", "flat_model"):
        values = sorted(data[column].dropna().astype(str).unique())
        print(f"Unique {column} values ({len(values)}): {', '.join(values)}")

    for column, label in (("resale_price", "Resale price"), ("floor_area_sqm", "Floor area")):
        print(f"{label} descriptive statistics:")
        print(data[column].describe().to_string())

    print("Remaining lease examples:")
    print(data["remaining_lease"].dropna().drop_duplicates().head(10).to_list())
    print("Storey range examples:")
    print(data["storey_range"].dropna().drop_duplicates().head(10).to_list())


if __name__ == "__main__":
    main()
