# Handoff 04: S3 Level 1 service monitoring runner

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Budget | 2.5 hours |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

A small Node runner that checks three public service endpoints from outside, classifies each result deterministically, and prints a readable report and structured JSON. It runs locally, against fixtures, and from GitHub Actions.

This is Level 1 only. No stored state, no alert delivery, no LLM, no new dependencies.

## Read first

- `AGENTS.md`
- `SGHomie/scripts/valuation-canary.mjs` and `SGHomie/tests/valuation-canary.test.mjs`: the existing pattern for a script with injected `fetch` and a Node test. Follow its style.
- `MLPricePredictorV2/src/api/app.py`, the `/health` and `/v1/valuation/model-info` handlers only, for response shapes.
- `SGHomie/BackEnd/supabase/functions/chatbot/index.ts`: only the request parsing and the branch that answers a caller who is not signed in, plus `chatbot/onboarding.ts`.
- `.github/workflows/tests.yml` for workflow conventions.

## Files

All new. Do not edit any existing file.

- `SGHomie/scripts/monitor/checks.mjs`
- `SGHomie/scripts/monitor/classify.mjs`
- `SGHomie/scripts/monitor/report.mjs`
- `SGHomie/scripts/monitor/fixtures/*.json`
- `SGHomie/scripts/service-monitor.mjs`
- `SGHomie/tests/service-monitor.test.mjs`
- `.github/workflows/service-monitor.yml`

Plain `.mjs` with JSDoc types, matching the existing script.

## Modules

| Module | Responsibility |
| --- | --- |
| `checks.mjs` | One request per target with a timeout. `fetch` and the clock are injected. Returns a raw observation: target, start time, duration, HTTP status or error kind, and a small set of parsed safe fields. Never returns the response body. |
| `classify.mjs` | Pure. Maps a raw observation to `healthy`, `failed` or `unknown` with a stable reason code. |
| `report.mjs` | Pure. Builds the terminal table and the JSON document from classified results. |
| `service-monitor.mjs` | Reads configuration from environment variables and flags, runs checks or loads fixtures, prints output, sets the exit code. |

## Targets

| Target | Request | Healthy when |
| --- | --- | --- |
| `frontend` | `GET` the site URL | Status 200 and the body contains the app's root element |
| `render_model` | `GET <render url>/health` | Status 200 with `status: "ok"` and `model_loaded: true` |
| `supabase_app` | One `POST` to the public chatbot function, as a caller who is not signed in | Status 200 with a non-empty onboarding reply |

Render model version:

- Checked only when both `MONITOR_RENDER_TOKEN` and `MONITOR_EXPECTED_MODEL_VERSION` are set. The runner then calls `GET <render url>/v1/valuation/model-info` with the token.
- A mismatch is `failed`. When not configured, the result says the version was not checked.

Supabase application path:

- Confirm from the code which request makes the function answer without any provider call, quota use or database write. Use that request. Report exactly what the function does for it, with file and line references.
- If you cannot confirm that the request causes no write and no provider call, stop and report.

## Classification rules

- `failed`: the service answered and the answer shows a fault. Examples: an explicit not-ready health response, a wrong model version, a 5xx status, a 200 with an invalid body.
- `unknown`: no trustworthy answer. Examples: timeout, network error, an unexpected status such as 401, 403, 404 or 429, or a target with no configured URL (`not_configured`).
- `healthy`: only when every condition in the table holds.
- A timeout is never `failed`. Render's free tier can take a long time to wake.
- Every result carries: target, status, reason code, start timestamp in ISO 8601, duration in milliseconds, and HTTP status when there was one.

Decide the reason codes and keep them stable, upper snake case, as the existing canary does.

## Configuration

Environment variables: `MONITOR_FRONTEND_URL`, `MONITOR_RENDER_URL`, `MONITOR_SUPABASE_URL`, `MONITOR_SUPABASE_ANON_KEY`, `MONITOR_RENDER_TOKEN`, `MONITOR_EXPECTED_MODEL_VERSION`, `MONITOR_TIMEOUT_MS`.

Flags:

- `--fixtures <name>`: load a fixture and make no network call.
- `--json <path>`: also write the JSON document to a file.

Exit code: `1` when at least one target is `failed`, otherwise `0`. `unknown` does not fail the run.

## Safety requirements

- Read-only requests. `GET` for the first two targets. One `POST` for the third, confirmed to cause no write.
- No retries and no loops. One request per target per run, plus the optional version request.
- Never print or store a token, key, `Authorization` header, URL query string or response body. Report the host only for each target.
- Errors are reduced to a reason code. No raw error message or stack trace in output.
- Do not follow redirects to another host.

## Fixtures

At least: all healthy; Render not ready; Render version mismatch; frontend timeout; Supabase unexpected status; nothing configured. Fixtures hold raw observations, so fixture mode exercises `classify` and `report` exactly as a live run does.

## Workflow

`.github/workflows/service-monitor.yml`:

- Triggers: `schedule` (every 30 minutes), `workflow_dispatch`, and `push` limited to branch `assessment/ncs-opspilot` and the monitor file paths.
- `permissions: contents: read`.
- Node version as in `tests.yml`. No dependency install is needed if the runner uses only Node built-ins.
- Step 1 runs a fixture scenario. Step 2 runs the live checks with URLs from repository variables and the optional token from a secret.
- The table goes to the job summary. The JSON is uploaded as an artifact.
- A comment at the top states that GitHub runs scheduled workflows only from the default branch, so the schedule is inactive until this file is merged there.

## Tests

Node built-in runner, no network, in `SGHomie/tests/service-monitor.test.mjs`. Write them first.

1. Each target classifies healthy, failed and unknown, including timeout, network error and malformed body.
2. A missing URL yields `unknown` with `not_configured`, and no request is made.
3. The model version is requested only when configured. A mismatch is `failed`. A match is `healthy`.
4. Every result has a timestamp, a duration and a status.
5. The JSON document has a fixed shape. With a token, a key and a URL containing a query string supplied as input, none of them appears anywhere in the table or the JSON.
6. A response body supplied to a check does not appear in any output.
7. Exit code is 1 only when a target is `failed`.
8. Fixture mode makes no `fetch` call.
9. Each fixture produces its expected statuses.

## Checks to run

- Focused: `node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/service-monitor.test.mjs`
- A fixture run of the script itself, with its real terminal output.
- From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline: 440 Node tests pass, lint 0 errors with 2 existing warnings.

Do not run the script against any real URL. Live runs need the repository owner's approval.

## Constraints

- Do not stage, commit, push or deploy.
- Do not claim the schedule is active.
- Paste real command output. Never report a result you did not observe.

## Report back

- Files created.
- Red then green output for the focused test, and the four check results.
- The real terminal output and JSON of one fixture run.
- The exact request used for the Supabase target and the evidence that it causes no write, provider call or quota use.
- The reason codes.
- Limitations and anything unverified.
- A recommended Conventional Commits message.
