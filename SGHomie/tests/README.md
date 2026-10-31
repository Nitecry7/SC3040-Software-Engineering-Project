# Running SG Homie tests

## Final `main` release verification

Following the final integration merge to `main` at `db1385e1caab3f090eb95fcbf39c77bee6ce6711`, the supplied GitHub Actions `Repository tests` run passed all three jobs: Application, Valuation, and Database. Final local verification passed **439 Node tests**. CI passed **324 Python valuation tests** and **128 database pgTAP assertions**: 47 access-control/Storage, 65 monitoring, and 16 synthetic-canary persistence/security assertions. The disposable CI database applied all **24 repository migrations**; monitoring concurrency coverage passed **24 concurrent monitoring alert observations**. CI lint reported **0 errors and 2 existing non-blocking Fast Refresh warnings**; the actual app TypeScript project (`tsconfig.app.json`) and production build passed.

Local Node tests and GitHub Actions are separate evidence. The database job uses an isolated disposable CI database; it does not verify hosted Supabase migrations or Edge Function versions. A separate team report says the live frontend and login were manually verified on 1 November 2026; see the [deployment runbook](../docs/operations/deployment-runbook.md#release-verification-snapshot-1-november-2026). The hosted Chatbot synthetic-canary authentication issue remains deferred. No CI result establishes continuous availability or chatbot production authentication. The [October 28 `main` merge report](../docs/testing/merge-verification.md) and [initial pre-merge report](../docs/testing/test-report.md) remain historical snapshots; their original counts and evidence are unchanged.

## Application tests

Use Node.js 22.22.2 or a compatible newer release. From `SGHomie/FrontEnd/`:

```sh
npm ci
npm test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

`npm test` discovers every `SGHomie/tests/*.test.mjs` file, including backend handlers. No hosted service credentials are needed. Service and component fixtures are synthetic. VM-based React tests exercise application callbacks and state with isolated hooks; they do not prove browser rendering, focus, networking or RLS. Markdown tests use the actual React renderer. Existing source-text checks are supplementary static checks.

Use the explicit `-p tsconfig.app.json` option to typecheck the actual frontend application. The current supplied verification has no TypeScript errors. Historical typecheck failures are documented only in the dated [pre-merge report](../docs/testing/test-report.md).

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

Capture the ML JUnit and database TAP using the commands above. A nonzero application runner exit means the current run has failed cases; retain its completed ignored result files for diagnosis. The two failures described in the linked historical reports are not current results. Then run:

```sh
python3 SGHomie/tests/build-case-catalogue.py --node .test-results/application.jsonl --ml .test-results/valuation.xml --database .test-results/database.tap --output .test-results/case-catalogue.md --json-output .test-results/case-results.json
```

The generator excludes Node's parent/container result from independent case totals when JUnit contains only its child cases. Parameter-expanded Python cases remain separate. Generated output stays under ignored `.test-results/`; do not overwrite the frozen historical catalogues or evidence. Review the narrative report and environment metadata before recording a new dated snapshot.

## GitHub Actions workflow

The [Repository tests workflow](../../.github/workflows/tests.yml) runs on pull requests, pushes, and manual dispatch. Its application job uses Node 22.22.2 for the complete Node suite, lint, the actual `tsconfig.app.json` typecheck, and Vite production build. Its valuation job uses Python 3.12 and pytest with branch coverage. Its database job starts a disposable local Supabase stack, applies the repository migrations to a uniquely named temporary database, checks TAP plans and assertions, and stops the stack even after failure. Each job uploads machine-readable results. The database job does not connect to hosted Supabase.

The current supplied CI run passed all three jobs. A CI pass proves those checks passed for the run's source and environment; it does not prove hosted deployment or service state. VM-based React tests do not prove browser rendering, focus, networking or RLS. Database tests exercise PostgreSQL policies, triggers and constraints with simulated JWT claims; they do not verify Auth token signing, Storage HTTP uploads or the full Supabase service stack.
