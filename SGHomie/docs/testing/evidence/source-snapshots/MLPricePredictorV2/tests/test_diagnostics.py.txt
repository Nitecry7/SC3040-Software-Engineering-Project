import pandas as pd
import pytest

from src.evaluation.diagnostics import summarize_predictions


def test_diagnostics_report_all_groups_fallbacks_and_comparable_counts():
    predictions = pd.DataFrame(
        {
            "actual": [100, 200, 300, 400],
            "prediction": [110, 180, 330, 400],
            "town": ["B", "A", "B", "A"],
            "flat_type": ["4 ROOM", "3 ROOM", "4 ROOM", "3 ROOM"],
            "fallback_level": ["comparable", "global", "town_flat_type", "comparable"],
            "comparable_count": [5, 0, 0, 7],
        }
    )

    report = summarize_predictions(predictions)

    assert report.fallback_usage["count"].to_dict() == {
        "comparable": 2,
        "town_flat_type": 1,
        "global": 1,
    }
    assert report.fallback_usage.loc["comparable", "percentage"] == pytest.approx(50)
    assert report.mae_by_town["town"].tolist() == ["A", "B"]
    assert report.mae_by_town["mae_sgd"].tolist() == [10, 20]
    assert report.mae_by_flat_type["flat_type"].tolist() == ["3 ROOM", "4 ROOM"]
    assert report.comparable_count_stats == {
        "mean": 6.0,
        "median": 6.0,
        "minimum": 5,
        "maximum": 7,
    }


def test_comparable_count_summary_is_empty_when_all_predictions_fallback():
    predictions = pd.DataFrame(
        {
            "actual": [100],
            "prediction": [110],
            "town": ["A"],
            "flat_type": ["3 ROOM"],
            "fallback_level": ["global"],
            "comparable_count": [0],
        }
    )

    report = summarize_predictions(predictions)

    assert report.comparable_count_stats == {
        "mean": None,
        "median": None,
        "minimum": None,
        "maximum": None,
    }
