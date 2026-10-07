# SG Homie HDB resale price modelling (V2)

V2 is the clean research pipeline for HDB resale price evaluation. It supports
raw data profiling, deterministic row-wise feature preparation, chronological
partitions, historical transaction-price baselines, and initial leakage-safe
Linear and Ridge regression experiments. It does not serve valuations or
provide a production model.

## Dataset

- **Dataset:** Resale flat prices based on registration date from Jan-2017 onwards
- **Publisher:** Housing & Development Board (HDB)
- **Source:** [data.gov.sg](https://data.gov.sg/)
- **Resource ID:** `d_8b84c4ee58e3cfc0ece0d773c8ca6abc`
- **Local retrieval date:** 2026-10-04
- **Observed coverage:** 2017-01 through 2026-10
- **Update cadence:** the official source is updated daily; October 2026 is the
  current incomplete month as of retrieval.
- **Local input:** place the downloaded CSV in `data/raw/`. The current local file
  is `ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv`.
- Raw CSV files in `data/raw/` are intentionally ignored by Git and are not
included in commits. The local copy does not automatically synchronize with
data.gov.sg; retrieve and verify a new copy explicitly when refreshing data.

## Data handling

Preparation preserves source rows and indices. The profiler observed 318 exact
duplicate rows. There is no unique transaction identifier in the source, so
equality across recorded fields does not establish that records refer to the
same real-world transaction; duplicates are reported, never automatically
deleted. IQR screening for resale price and floor area is informational only and
does not remove records.

Base features are constructed row by row from transaction month/year, town,
flat type, block, street, flat model, floor area, lease commencement year,
parsed storey bounds/midpoint, and parsed remaining lease months. The target is
`resale_price`, kept separately from `X`. No price-derived features, target
aggregates, rolling price statistics, or target-based category encodings are
created. The learned model pipeline uses a fixed subset described below.

Default partitions are train (2017-01 to 2024-12), validation
(2025-01 to 2025-12), test (2026-01 to 2026-09), and current partial/future
period (2026-10 onward). The partial/future partition is excluded from
validation and test evaluation. Boundaries can be configured through
`SplitBoundaries`.

## Historical baselines

Baselines provide an interpretable reference that future learned models must
beat. They use completed resale transactions only, not current SG Homie asking
prices. For a prediction in month M, every baseline uses transaction months
strictly before M. All rows in M are predicted before any M prices are added to
history. Evaluation advances month by month; completed validation months may
inform later validation predictions, and completed test months may inform later
test predictions.

Three baselines are implemented:

1. **Global median:** median resale price across all eligible past transactions.
2. **Town and flat-type median:** median for the same town and flat type, with a
   global-median fallback.
3. **Recent comparable median:** same town and flat type, strictly prior sales
   inside a configurable lookback. Matching uses floor area, storey midpoint,
   remaining lease, and recency only; resale price is used only after selection
   to calculate the comparable median. If too few comparable sales qualify,
   the fallback order is town/flat-type median, then global median.

Validation alone selects among 12 predeclared configurations: lookback 6, 12,
or 24 months; floor-area tolerance 10 or 15 sqm; and minimum comparable count 5
or 10. Maximum comparables is 30, storey tolerance is 6 floors, and remaining
lease tolerance is 60 months. Lowest validation MAE is primary; configurations
within 1% of the best MAE are treated as tied, then ranked by fallback rate,
distance from the initial defaults, worst town/flat-type MAE, and a stable
parameter order. The selected configuration is frozen before final test
evaluation. Test results do not tune configuration. October 2026 onward is
excluded from both validation and test.

### Recorded evaluation

The local dataset was evaluated with the chronological procedure. MAE and RMSE
are SGD; MAPE is percent. These are historical baselines, not a production
machine-learning valuation model.

| Validation baseline | MAE | RMSE | MAPE | R2 |
|---|---:|---:|---:|---:|
| Global median | $199,982.71 | $264,540.46 | 27.04% | -0.6798 |
| Town + flat-type median | $161,613.31 | $195,249.81 | 23.25% | 0.0849 |
| Selected comparable median | $39,354.92 | $66,935.89 | 5.66% | 0.8925 |

Selected configuration: 12-month lookback, minimum 5 and maximum 30
comparables, 15 sqm floor-area tolerance, 6 storey-midpoint tolerance, and
60-month remaining-lease tolerance. It was selected from the within-1% validation
MAE band because it had lower fallback use than the lowest-MAE configuration.

| Final test selected comparable | Value |
|---|---:|
| Predictions | 19,641 |
| MAE | $40,932.90 |
| RMSE | $70,470.57 |
| MAPE | 5.90% |
| R2 | 0.8937 |
| Median absolute error | $25,000.00 |
| Comparable fallback usage | 19,284 (98.18%) |
| Town/flat-type fallback usage | 357 (1.82%) |
| Global fallback usage | 0 (0.00%) |
| Comparable count when used (mean / median) | 27.89 / 30 |
| Comparable count when used (min / max) | 5 / 30 |

Test town and flat-type MAE, fallback counts, and comparable-count statistics
are printed by `scripts/evaluate_baselines.py`. Performance varies across groups;
small groups such as multi-generation flats have few observations and noisy
error estimates.

## Initial learned linear models

`scripts/evaluate_linear_models.py` compares ordinary Linear Regression with
Ridge Regression at alphas 0.1, 1, 10, and 100. Both use the same sparse
one-hot categorical encoding and numeric scaling inside a scikit-learn
pipeline. Unknown categories are ignored at transform time. Encoders and
scalers are fitted only on training data for validation; the selected pipeline
is then refitted on train plus validation before test evaluation. No model
artifact or processed dataset is written.

The model feature schema is `transaction_year`, `transaction_month`,
`floor_area_sqm`, `storey_mid`, `remaining_lease_months`, `town`, `flat_type`,
`block`, `street_name`, and `flat_model`. `storey_low` and `storey_high` are
omitted because their midpoint is an exact linear combination. The observed
correlation between `lease_commence_date` and `remaining_lease_months` is 0.982,
so lease commencement is omitted in favor of remaining lease. Block and street
are retained as sparse categories despite their high cardinality. The selector
uses validation MAE, treats candidates within 1% of the minimum as tied, then
uses RMSE, median absolute error, and model simplicity. Test results do not
select the model or alpha.

On the current local dataset (241,920 rows), the selected validation model was
Linear Regression. Its validation MAE was $50,772.32, RMSE $70,114.17, MAPE
7.44%, R2 0.8820, and median absolute error $38,617.41. The best Ridge result
was alpha 0.1, with validation MAE $50,793.75. Linear Regression was selected
within the 1% MAE band because it had lower RMSE. The selected comparable
baseline validation MAE was $39,354.92; Linear Regression underperformed it on
MAE.

After refitting Linear Regression on 2017-01 through 2025-12, its 2026-01 to
2026-09 test results were MAE $49,861.68, RMSE $69,194.33, MAPE 8.08%, R2
0.8975, and median absolute error $37,212.77. The comparable baseline test
reference was MAE $40,932.90, RMSE $70,470.57, MAPE 5.90%, R2 0.8937, and
median absolute error $25,000. The learned model underperformed on MAE, MAPE,
and median absolute error while having lower RMSE and higher R2. This is an
initial research result, not a production valuation. Test town and flat-type
MAE with support counts and coefficient diagnostics are printed by the script.

The selected pipeline has 3,375 encoded features. Train plus validation design
data has shape 222,067 by 3,375, with approximately 26.13 MiB of CSR storage.
The largest coefficients are descriptive contrasts against dropped one-hot
reference categories; they are not causal explanations. Correlated property
attributes and high-cardinality locations make individual coefficients
unstable and should be interpreted cautiously.

The test comparison is not a perfectly matched update protocol: the historical
comparable baseline advances month by month and may use completed earlier test
months, while the learned model is frozen after 2025-12 as required by this
evaluation. Neither test result was used for model selection. Current partial
period rows from 2026-10 onward remain excluded.

The legacy `MLPricePredictor/` experiments contain target leakage, including
features derived from the transaction price being predicted. Their model
metrics and generated outputs therefore must not be trusted as evidence of
future performance or used as production evidence. The V2 linear models are
also research candidates only and do not establish production readiness.

## Intended future purpose

The eventual purpose is to evaluate an HDB resale price estimate using only
information available at prediction time, with chronological validation,
appropriate baseline comparisons, and documented provenance. Historical
baselines and initial linear model evaluation are implemented. Stronger
feature design and model families, model persistence, and a narrow FastAPI
inference interface remain future work.

## Setup and commands

From this directory, install dependencies and run:

```powershell
python -m pip install -r requirements.txt
python scripts/profile_data.py
python scripts/prepare_data.py
python scripts/evaluate_baselines.py
python scripts/evaluate_linear_models.py
python -m pytest
```

The profiler, preparation script, and baseline evaluation script load the raw
CSV without modifying it. Preparation reports partition shapes/date ranges and
quality screening without writing processed artifacts. Evaluation prints
metrics and diagnostics without persisting a large artifact. Learned models
are fitted in memory by the evaluation script and are not saved.
