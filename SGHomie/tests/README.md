# Running SG Homie tests

The latest [main merge verification](../docs/testing/merge-verification.md) records 640 cases and the [current case catalogue](../docs/testing/test-case-catalogue-after-main.md) lists their outcomes. The [initial testing report](../docs/testing/test-report.md) retains the original 580-case run, measured coverage, confirmed fixes, open defects and remaining acceptance work. Earlier added scenarios and incoming main tests are both preserved.

## Application tests

Use Node.js 22.22.2 or a compatible newer release. From `SGHomie/FrontEnd/`:

```sh
npm ci
npm test
npm run lint
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

`npm test` discovers every `SGHomie/tests/*.test.mjs` file, including backend handlers. No hosted service credentials are needed. Service and component fixtures are synthetic. VM-based React tests exercise application callbacks and state with isolated hooks; they do not prove browser rendering, focus, networking or RLS. Markdown tests use the actual React renderer. Existing source-text checks are supplementary static checks.

The wrapper `npx tsc --noEmit` does not check the actual app because its configuration contains an empty file list and project references. Keep the explicit `-p tsconfig.app.json` check. At the recorded run it reports seven pre-existing errors. Two preserved JavaScript assertions also fail; see the report rather than treating the suite as green.

`npm run test:coverage` is an optional Node diagnostic. VM-transpiled component/handler coverage is not a reliable measure of original TypeScript coverage, so no whole-app coverage percentage or threshold is claimed.

## Valuation research and API

From `MLPricePredictorV2/`, using Python 3.12:

```sh
python3.12 -m venv /tmp/sghomie-test-venv
/tmp/sghomie-test-venv/bin/python -m pip install -r requirements.txt coverage
/tmp/sghomie-test-venv/bin/python -m pytest -q --junitxml=../.test-results/valuation.xml
COVERAGE_FILE=/tmp/sghomie-test.coverage /tmp/sghomie-test-venv/bin/python -m coverage run --branch --source=src -m pytest -q
COVERAGE_FILE=/tmp/sghomie-test.coverage /tmp/sghomie-test-venv/bin/python -m coverage report
```

Tests use temporary synthetic CSVs, small CPU estimators and temporary bundles. They do not require the ignored source dataset, a trained production bundle, private releases, Render or a GPU. Do not run or reuse the legacy `MLPricePredictor/` metrics as evidence.

## Database access rules and migrations

Run Docker and an **explicitly local** Supabase stack. For a new local stack, install the backend dependencies and run `npx supabase start` from `SGHomie/BackEnd/`. Starting a local stack may use substantial disk space. The test helper also works when that local stack has an older application schema: it does not reset or migrate that existing database.

From the repository root:

```sh
python3 SGHomie/tests/run-database-tests.py --output .test-results/database.tap
```

The helper copies **only auth/storage pre-data structure**, restores the primary keys needed by migrations, applies all repository application migrations to a uniquely named temporary database, runs the pgTAP suite, rolls back fixtures, and drops only that temporary database in a `finally` block. It uses the existing local Supabase database container `supabase_db_SGHomie`; `--container` can name another local test stack. No records, application policies or application tables are copied from the existing database. No linked-project credentials or hosted reset commands are used.

The helper checks the TAP plan and assertion count for each SQL file and exits nonzero for a failed assertion or setup error. If the process is forcibly killed before cleanup, inspect for a database whose name starts `sghomie_test_` and remove only that disposable database. The tests exercise actual PostgreSQL RLS, triggers and constraints with simulated JWT claims; they do not verify Auth token signing, Storage HTTP uploads or the entire Supabase service stack.

## Capturing and rebuilding the catalogue

From the repository root, with Python dependencies installed:

```sh
mkdir -p .test-results
node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test --test-reporter=./SGHomie/tests/reporters/case-results.mjs --test-reporter-destination=.test-results/application.jsonl --test-reporter=junit --test-reporter-destination=.test-results/application.xml SGHomie/tests/*.test.mjs
```

Capture the ML JUnit and database TAP using the commands above. The application runner intentionally returns nonzero for the two currently preserved failures; its completed evidence files still contain their real outcomes. Then run:

```sh
python3 SGHomie/tests/build-case-catalogue.py --node .test-results/application.jsonl --ml .test-results/valuation.xml --database .test-results/database.tap --output SGHomie/docs/testing/test-case-catalogue-after-main.md --json-output SGHomie/docs/testing/evidence/after-main/case-results.json
```

The generator excludes Node's parent/container result from independent case totals when JUnit contains only its child cases. Parameter-expanded Python cases remain separate. Review the narrative report and environment metadata when refreshing a dated evidence snapshot.

The GitHub Actions [test workflow](../../.github/workflows/tests.yml) prepares application, valuation and local-database jobs and retains machine-readable results. Its first hosted run is pending; local results are not evidence that CI has already passed. Current retained failures and app type errors deliberately remain visible.
