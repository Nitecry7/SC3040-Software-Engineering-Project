import numpy as np
import pandas as pd
import pytest

from src.baselines.comparable_sales import ComparableConfig
from src.evaluation.frozen_history import evaluate_frozen_history_comparable
from src.evaluation.metrics import RegressionMetrics
from src.evaluation.robustness import (
    RepeatabilityRun,
    expanding_year_partitions,
    summarize_group_mae,
    summarize_monthly_drift,
    summarize_repeatability,
)
from src.models.boosted import (
    CATEGORICAL_FEATURES,
    FROZEN_CATBOOST_CONFIG,
    FROZEN_CATBOOST_ITERATIONS,
    fit_frozen_catboost,
)


def comparable_rows():
    frame = pd.DataFrame(
        {
            "transaction_period": pd.PeriodIndex(
                ["2020-01", "2021-01", "2021-06", "2021-12", "2022-01", "2022-02", "2023-01", "2026-10"],
                freq="M",
            ),
            "resale_price": [100.0, 200.0, 300.0, 500.0, 700.0, 800.0, 999999.0, 999999.0],
            "town": ["TOWN"] * 8,
            "flat_type": ["3 ROOM"] * 8,
            "floor_area_sqm": [90.0] * 8,
            "storey_mid": [5.0] * 8,
            "remaining_lease_months": [600.0] * 8,
        },
        index=[10, 20, 30, 40, 50, 60, 70, 80],
    )
    return frame


def test_frozen_comparable_keeps_cutoff_history_constant_and_uses_cutoff_month():
    rows = comparable_rows()
    evaluation = rows.loc[[50, 60]].copy()
    result = evaluate_frozen_history_comparable(
        rows,
        evaluation,
        pd.Period("2021-12", freq="M"),
        ComparableConfig(minimum_comparables=5),
    )

    # The static town median includes all pre-period transactions, including Dec.
    # It excludes evaluation and later actuals despite those rows being in all_rows.
    assert result["prediction"].tolist() == [250.0, 250.0]
    assert result["historical_cutoff_month"].tolist() == [pd.Period("2021-12", freq="M")] * 2
    assert result["target_month"].tolist() == [pd.Period("2022-01", freq="M"), pd.Period("2022-02", freq="M")]


def test_evaluation_year_target_mutation_cannot_change_frozen_comparable_predictions():
    rows = comparable_rows()
    evaluation = rows.loc[[50, 60]].copy()
    changed_all = rows.copy()
    changed_all.loc[[50, 60], "resale_price"] = [1.0, 2.0]
    changed_evaluation = changed_all.loc[[50, 60]].copy()
    config = ComparableConfig(minimum_comparables=5)

    original = evaluate_frozen_history_comparable(
        rows, evaluation, pd.Period("2021-12", freq="M"), config
    )
    changed = evaluate_frozen_history_comparable(
        changed_all, changed_evaluation, pd.Period("2021-12", freq="M"), config
    )

    pd.testing.assert_series_equal(original["prediction"], changed["prediction"])


def test_frozen_comparable_rejects_rows_at_or_before_cutoff_and_partial_period():
    rows = comparable_rows()
    cutoff = pd.Period("2021-12", freq="M")
    config = ComparableConfig(minimum_comparables=5)
    with pytest.raises(ValueError, match="strictly after"):
        evaluate_frozen_history_comparable(rows, rows.loc[[40]], cutoff, config)
    with pytest.raises(ValueError, match="partial period"):
        evaluate_frozen_history_comparable(
            rows,
            rows.loc[[80]],
            pd.Period("2026-09", freq="M"),
            config,
        )


def test_expanding_year_partition_ends_training_before_year_and_excludes_other_years():
    periods = pd.Series(
        pd.PeriodIndex(["2021-12", "2022-01", "2022-12", "2023-01"], freq="M"),
        index=[4, 8, 12, 16],
    )
    features = pd.DataFrame({"feature": [1, 2, 3, 4]}, index=periods.index)
    target = pd.Series([10.0, 20.0, 30.0, 40.0], index=periods.index)
    training, evaluation = expanding_year_partitions(features, target, periods, 2022)
    assert training.features.index.tolist() == [4]
    assert evaluation.features.index.tolist() == [8, 12]
    assert training.transaction_period.max() == pd.Period("2021-12", freq="M")
    assert set(evaluation.transaction_period.dt.year) == {2022}


def test_expanding_year_partition_can_stop_before_partial_month_but_rejects_it():
    periods = pd.Series(pd.PeriodIndex(["2025-12", "2026-01", "2026-09", "2026-10"], freq="M"))
    features = pd.DataFrame({"feature": [1, 2, 3, 4]})
    target = pd.Series([10.0, 20.0, 30.0, 40.0])
    training, evaluation = expanding_year_partitions(
        features.iloc[:3], target.iloc[:3], periods.iloc[:3], 2026, evaluation_end_month=9
    )
    assert training.transaction_period.max() == pd.Period("2025-12", freq="M")
    assert evaluation.transaction_period.max() == pd.Period("2026-09", freq="M")
    with pytest.raises(ValueError, match="partial period"):
        expanding_year_partitions(features, target, periods, 2026, evaluation_end_month=10)


def test_fixed_catboost_fit_uses_only_supplied_labels_and_frozen_configuration(monkeypatch):
    import src.models.boosted as boosted

    captured = {}

    class FitSpy:
        def fit(self, features, target, *, cat_features, verbose):
            captured["features"] = features.copy()
            captured["target"] = target.copy()
            captured["cat_features"] = cat_features

    def build_spy(config, device, *, iterations, validation):
        captured["config"] = config
        captured["device"] = device
        captured["iterations"] = iterations
        captured["validation"] = validation
        return FitSpy()

    monkeypatch.setattr(boosted, "build_boosted_estimator", build_spy)
    training = pd.DataFrame(
        {
            "transaction_year": [2020, 2020],
            "transaction_month": [1, 2],
            "floor_area_sqm": [80.0, 90.0],
            "storey_mid": [3.0, 5.0],
            "remaining_lease_months": [600.0, 610.0],
            "town": ["TRAIN TOWN", "TRAIN TOWN"],
            "flat_type": ["3 ROOM", "4 ROOM"],
            "block": ["1", "2"],
            "street_name": ["ROAD", "ROAD"],
            "flat_model": ["Model A", "Model B"],
        },
        index=[4, 8],
    )
    target = pd.Series([250000.0, 300000.0], index=training.index)
    model = fit_frozen_catboost(training, target, device="cpu")

    assert model.config == FROZEN_CATBOOST_CONFIG
    assert model.iterations == FROZEN_CATBOOST_ITERATIONS == 1998
    assert captured["config"] == FROZEN_CATBOOST_CONFIG
    assert captured["iterations"] == 1998
    assert captured["validation"] is False
    parameters = captured["config"].parameters_for("cpu", iterations=1998, validation=False)
    assert parameters["depth"] == 8
    assert parameters["learning_rate"] == 0.05
    assert parameters["l2_leaf_reg"] == 3.0
    assert parameters["has_time"] is True
    assert parameters["random_seed"] == 42
    assert "od_wait" not in parameters
    assert captured["target"].tolist() == target.tolist()
    assert captured["features"]["town"].tolist() == ["TRAIN TOWN", "TRAIN TOWN"]
    assert captured["cat_features"] == list(CATEGORICAL_FEATURES)


def metric(mae, rmse, mape):
    return RegressionMetrics(mae, rmse, mape, 0.5, mae, 2, 100.0, 101.0)


def test_repeatability_summary_aggregates_runs_without_selecting_a_winner():
    runs = [
        RepeatabilityRun(metric(10.0, 12.0, 1.0), 4.0, 1.0, pd.Series([0.0, 1.0], index=[1, 2])),
        RepeatabilityRun(metric(12.0, 14.0, 2.0), 5.0, 2.0, pd.Series([1.0, 2.0], index=[1, 2])),
        RepeatabilityRun(metric(14.0, 16.0, 3.0), 6.0, 3.0, pd.Series([2.0, 3.0], index=[1, 2])),
    ]
    summary = summarize_repeatability(runs)
    assert summary.repeat_count == 3
    assert summary.mean_mae_sgd == 12.0
    assert summary.minimum_mae_sgd == 10.0
    assert summary.maximum_mae_sgd == 14.0
    assert summary.mae_range_sgd == 4.0
    assert summary.mean_rmse_sgd == 14.0
    assert summary.mean_mape_percent == 2.0
    assert summary.mean_pairwise_prediction_difference_sgd == pytest.approx(4 / 3)
    assert summary.maximum_pairwise_prediction_difference_sgd == 2.0
    assert not hasattr(summary, "selected_run")


def test_monthly_drift_and_group_support_summaries_match_hand_calculation():
    predictions = pd.DataFrame(
        {
            "transaction_period": pd.PeriodIndex(["2022-01", "2022-01", "2022-02"], freq="M"),
            "actual": [100.0, 200.0, 200.0],
            "prediction": [110.0, 180.0, 230.0],
            "town": ["A", "A", "B"],
            "flat_type": ["3 ROOM", "3 ROOM", "4 ROOM"],
        }
    )
    monthly, slope = summarize_monthly_drift(predictions)
    assert monthly["support"].tolist() == [2, 1]
    assert monthly["mae_sgd"].tolist() == [15.0, 30.0]
    assert monthly["prediction_bias_sgd"].tolist() == [-5.0, 30.0]
    assert slope == pytest.approx(15.0)
    grouped = summarize_group_mae(predictions, "flat_type")
    assert grouped["support"].tolist() == [2, 1]
    assert grouped["mae_sgd"].tolist() == [15.0, 30.0]
