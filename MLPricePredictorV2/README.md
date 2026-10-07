# SG Homie HDB resale price modelling (V2)

V2 is the clean research pipeline for HDB resale price evaluation. It supports
raw data profiling, deterministic row-wise feature preparation, chronological
partitions, historical transaction-price baselines, and initial leakage-safe
Linear, Ridge, and nonlinear tree benchmark experiments. It does not serve
valuations or provide a production model.

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

## Nonlinear tree benchmarks

`scripts/evaluate_tree_models.py` compares Extra Trees, Random Forest, and
HistGradientBoosting using the chronological partitions above. The four forest
candidates use the fixed 100-tree, `max_features=1.0`, seed-42 setup and compare
minimum leaf sizes 2 and 10. Forests use the same five one-hot categorical and
five numeric features as the linear pipeline, but numeric columns are not
scaled. The two HistGradientBoosting candidates compare 100 and 200 boosting
iterations; both use learning rate 0.1, `max_leaf_nodes=31`,
`min_samples_leaf=20`, `l2_regularization=1.0`, `early_stopping=False`, and
seed 42. It uses native categorical data for town, flat type, and flat model;
block and street are omitted because their category cardinalities exceed the
estimator's `max_bins=255` limit. Category values are learned from the fitting
partition only, and unseen values map to missing.

All six candidates fit only on 2017-01 through 2024-12 and are scored on 2025.
Selection uses the 1% validation MAE band, followed by RMSE, median absolute
error, MAPE, configuration simplicity, measured runtime and memory, and a
stable tie-break. The frozen selected configuration is refitted through
2025-12 and evaluated once on 2026-01 through 2026-09. Validation and test
targets do not fit preprocessing or model parameters; 2026-10 onward is
excluded. The script reports candidate and final matrix/model memory, fit and
prediction time, test MAE by town and flat type with support, and aggregated
impurity feature importance where the estimator exposes it. Impurity importance
is noncausal and can favor high-cardinality features.

On the local 241,920-row CSV, the six validation candidates produced:

| Candidate | Validation MAE | RMSE | MAPE | Fit seconds | Estimator size estimate |
|---|---:|---:|---:|---:|---:|
| Extra Trees, leaf 2 | $43,443.85 | $56,546.91 | 6.55% | 989.27 | 1,136.57 MiB |
| Extra Trees, leaf 10 | $46,452.53 | $64,009.61 | 6.80% | 225.28 | 185.61 MiB |
| Random Forest, leaf 2 | $46,808.59 | $62,509.40 | 6.97% | 678.24 | 741.90 MiB |
| Random Forest, leaf 10 | $51,095.84 | $73,152.73 | 7.41% | 131.25 | 131.90 MiB |
| HistGradientBoosting, 100 iterations | $49,911.97 | $66,744.98 | 7.32% | 0.61 | 0.43 MiB |
| HistGradientBoosting, 200 iterations | $48,578.84 | $64,173.23 | 7.17% | 0.91 | 0.84 MiB |

Extra Trees with minimum leaf size 2 had the lowest validation MAE and was
selected. Its validation MAE was $43,443.85, RMSE $56,546.91, MAPE 6.55%, R2
0.9232, and median absolute error $36,050.04. It was better than the recorded
Linear/Ridge validation MAEs ($50,772.32 / $50,793.75), but worse than the
fixed comparable-baseline validation MAE of $39,354.92. The comparable
configuration was evaluated as a reference only and did not enter tree
selection.

After refitting on train plus validation, the frozen Extra Trees model scored
the test period at MAE $30,056.10, RMSE $44,414.51, MAPE 4.55%, R2 0.9578,
median absolute error $21,287.12, mean actual price $663,826.70, and mean
predicted price $663,921.94. The previously recorded comparable baseline test
metrics were MAE $40,932.90, RMSE $70,470.57, MAPE 5.90%; recorded Linear
Regression test metrics were $49,861.68, $69,194.33, and 8.08% respectively.
These references were not rerun or used to select the tree model. The
comparable baseline uses month-by-month test updates, whereas the learned model
is frozen after 2025-12, so this is not a matched update protocol.

The final encoded design matrix was 222,067 by 3,380 with 2,220,670 nonzero
entries and 26.26 MiB of CSR storage. The selected final estimator's serialized
size estimate was 1,281.10 MiB; its train-only validation counterpart was
1,136.57 MiB. Extra Trees fit on train plus validation in 956.98 seconds and
predicted test rows in 0.07 seconds. The full script, including all six
validation fits and the validation comparable reference, took 2,999.24 seconds
(about 50 minutes) on the local environment. The validation forest input
matrix was 196,982 by 3,358 with 23.29 MiB of CSR storage. Test town MAEs
ranged from $21,712.50 (Bukit Batok, n=1,118) to $48,938.84 (Queenstown,
n=616). Flat-type MAEs ranged from $17,805.21 (2 ROOM, n=588) to $136,968.90
(MULTI-GENERATION, n=6); the low-support group estimate is noisy.

Aggregated impurity importance ranked flat type, town, and transaction year
highest. These values are noncausal and may favor high-cardinality predictors.
Results are research benchmarks, not evidence of production valuation quality.
The large, slow Extra Trees fit and high serialized estimator size are material
deployment limitations. Next, investigate a compute-efficient and stable model
that improves validation error over the comparable-sales baseline before
considering persistence or inference integration.

## CatBoost and XGBoost benchmarks

`scripts/evaluate_boosted_models.py` adds validation-only CatBoost and XGBoost
comparisons. It defaults to `--device gpu`; the script checks `nvidia-smi`,
CatBoost GPU availability, and small CatBoost/XGBoost CUDA smoke fits before
training. `--device cpu` is an explicit development option. A requested GPU
that either library cannot use is an error; the script never deliberately
switches a GPU request to CPU. On Windows, install the pinned-compatible
requirements from this directory before running the benchmark.

Both models use the same ten base features as the linear and tree experiments:
numeric `transaction_year`, `transaction_month`, `floor_area_sqm`,
`storey_mid`, and `remaining_lease_months`, plus native categorical `town`,
`flat_type`, `block`, `street_name`, and `flat_model`. No target-derived or
price aggregate features are used. Train partitions are stable-sorted by
transaction year/month before fitting. CatBoost receives the five categorical
columns directly, uses `has_time=True`, and learns its categorical statistics
from the current fit rows and labels only. XGBoost receives pandas categorical
columns with category vocabularies fitted on training rows only; unknown
validation/test values become missing. Neither model uses external target
encoding. Numeric features are not scaled.

Each family has four validation configurations (2,000 maximum rounds, seed 42,
100-round early stopping). CatBoost crosses depth 6/8 with learning rate
0.03/0.05, fixing RMSE objective, MAE evaluation, and L2 leaf regularization 3.
XGBoost crosses depth 6/8 with minimum child weight 5/10, fixing learning rate
0.05, subsample and column sample 0.8, L2 regularization 1, MAE evaluation,
and native-category limits 4/64. Selection considers all eight validation
results: lowest MAE, then the 1% MAE tie band and deterministic RMSE, median
absolute error, MAPE, simplicity, serialized-size, runtime, and config ordering
rules. Test results are excluded from selection. The selected round count is
frozen from validation; that configuration is refitted on train plus validation
through 2025-12 and evaluated once on 2026-01 through 2026-09. The partial
2026-10 rows are excluded.

The local GPU run used CatBoost 1.2.10 and XGBoost 3.2.0 on an NVIDIA GeForce
RTX 3080 Ti Laptop GPU (GPU 0, 16 GiB, CUDA-enabled XGBoost build). XGBoost
3.2.0 is the newest version available for this Python 3.11 environment on the
configured package index; its supported CUDA and categorical interfaces match
the implementation. CatBoost GPU training can be nondeterministic. The local
source file remains a manually retrieved dataset and does not sync automatically.

| Validation candidate | MAE | RMSE | MAPE | Fit seconds | Serialized MiB |
|---|---:|---:|---:|---:|---:|
| CatBoost depth 6, LR 0.03 | $36,331.24 | $49,535.14 | 5.41% | 40.86 | 63.54 |
| CatBoost depth 6, LR 0.05 | $35,018.66 | $47,467.15 | 5.22% | 41.30 | 79.05 |
| CatBoost depth 8, LR 0.03 | $34,492.75 | $46,716.88 | 5.15% | 56.69 | 114.83 |
| CatBoost depth 8, LR 0.05 | **$33,524.38** | **$45,217.47** | **5.02%** | 59.87 | 147.35 |
| XGBoost depth 6, child weight 5 | $44,089.44 | $58,607.68 | 6.59% | 12.28 | 138.48 |
| XGBoost depth 6, child weight 10 | $43,565.62 | $57,343.66 | 6.54% | 11.79 | 114.96 |
| XGBoost depth 8, child weight 5 | $43,817.40 | $58,704.31 | 6.55% | 22.63 | 296.82 |
| XGBoost depth 8, child weight 10 | $43,261.07 | $56,663.10 | 6.51% | 22.36 | 173.72 |

CatBoost depth 8 at learning rate 0.05 was selected by validation MAE. Its
validation metrics were RMSE $45,217.47, MAPE 5.02%, R2 0.9509, and median
absolute error $26,456.09. It improved on the recorded validation MAE of the
comparable-sales baseline ($39,354.92), Linear Regression ($50,772.32), and
Extra Trees ($43,443.85). Those recorded benchmarks were comparison references
only; they were not rerun or used to select this model.

The final refit used 1,998 rounds on 222,067 rows through 2025-12. The test
metrics were MAE $29,490.56, RMSE $41,587.78, MAPE 4.52%, R2 0.9630, and median
absolute error $21,852.89. Mean actual price was $663,826.70 and mean predicted
price was $669,591.22. The recorded comparable baseline, Linear Regression,
and Extra Trees test MAEs were $40,932.90, $49,861.68, and $30,056.10
respectively. Their references were not re-evaluated. The comparable baseline
advances history month by month, while this learned model is frozen after
2025-12, so these figures use different update protocols.

Test MAE by town (support n): Ang Mo Kio $31,326 (674), Bedok $35,002 (1,045),
Bishan $42,240 (329), Bukit Batok $22,518 (1,118), Bukit Merah $40,579 (722),
Bukit Panjang $28,331 (619), Bukit Timah $41,946 (46), Central Area $47,231
(141), Choa Chu Kang $24,834 (820), Clementi $33,625 (392), Geylang $29,624
(504), Hougang $29,642 (988), Jurong East $25,901 (384), Jurong West $26,590
(1,170), Kallang/Whampoa $37,176 (586), Marine Parade $44,048 (98), Pasir Ris
$26,070 (610), Punggol $29,152 (1,331), Queenstown $45,475 (616), Sembawang
$26,427 (661), Sengkang $27,202 (1,391), Serangoon $31,629 (295), Tampines
$23,579 (1,630), Toa Payoh $39,073 (762), Woodlands $24,351 (1,459), and
Yishun $24,822 (1,250). By flat type: 1 ROOM $14,740 (8), 2 ROOM $15,265
(588), 3 ROOM $21,844 (4,505), 4 ROOM $28,556 (8,649), 5 ROOM $37,425
(4,613), EXECUTIVE $40,543 (1,272), and MULTI-GENERATION $88,056 (6). The
1 ROOM and MULTI-GENERATION estimates have low support.

Aggregated CatBoost model-native prediction-change importance ranked flat type,
transaction year, street name, town, and remaining lease highest in this run.
These are noncausal diagnostics and can be affected by correlated features and
category cardinality; they do not explain causal price effects. The final
model serialized to 143.99 MiB in a temporary file that was removed. Candidate
training peaked at 15,542 MiB GPU memory used; sampled peak utilization was 73%.
The selected validation fit took 59.87 seconds, final refit 82.77 seconds, and
test prediction 0.25 seconds. Total benchmark time was 365.74 seconds. XGBoost
warned that prediction from CPU-resident pandas input used a DMatrix fallback,
which may increase memory use and prediction time. CatBoost reached the
configured 2,000-round limit in all four candidates, so the 100-round early
stopping setting did not shorten those fits. These results are local research
measurements and do not establish production readiness.

For Google Colab, clone/download this repository, put the same official CSV in
`MLPricePredictorV2/data/raw/`, install `MLPricePredictorV2/requirements.txt`,
and select a CUDA runtime. From the V2 directory, run:

```powershell
python scripts/evaluate_boosted_models.py --device gpu
```

The script will validate GPU availability and fail rather than run a requested
GPU benchmark on CPU. Results can differ by GPU, library build, and CatBoost
GPU nondeterminism. Do not upload the raw CSV to Git or treat Colab output as
an approved production model.

The legacy `MLPricePredictor/` experiments contain target leakage, including
features derived from the transaction price being predicted. Their model
metrics and generated outputs therefore must not be trusted as evidence of
future performance or used as production evidence. The V2 linear models are
also research candidates only and do not establish production readiness.

## Intended future purpose

The eventual purpose is to evaluate an HDB resale price estimate using only
information available at prediction time, with chronological validation,
appropriate baseline comparisons, and documented provenance. Historical
baselines, linear and Ridge models, and initial nonlinear tree benchmarks are
implemented. Broader feature design and model evaluation, model persistence,
and a narrow FastAPI inference interface remain future work.

## Setup and commands

From this directory, install dependencies and run:

```powershell
python -m pip install -r requirements.txt
python scripts/profile_data.py
python scripts/prepare_data.py
python scripts/evaluate_baselines.py
python scripts/evaluate_linear_models.py
python scripts/evaluate_tree_models.py
python scripts/evaluate_boosted_models.py --device gpu
python -m pytest
```

The profiler, preparation script, and baseline evaluation script load the raw
CSV without modifying it. Preparation reports partition shapes/date ranges and
quality screening without writing processed artifacts. Evaluation prints
metrics and diagnostics without persisting a large artifact. Learned models
are fitted in memory by the evaluation script and are not saved.
