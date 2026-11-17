# Baseline

Recorded 16 November 2026, before any assessment change to application code.

This document separates what SGHomie already did from the new assessment work. Statements about hosted services are marked as unverified unless a check was actually performed.

## Git state

| Item | State |
| --- | --- |
| Branch | `assessment/ncs-opspilot` |
| HEAD | `1986c1f` |
| Working tree | Clean |
| Assessment baseline | `bac6948`, which is also `main` |
| Commits since baseline | `791897a` adds `AGENTS.md`; `1986c1f` adds `CLAUDE.md` |

All application code, migrations, Edge Functions and tests predate the assessment. There are no tags.

## Functionality that predates the assessment

- Buyer search, property details, enquiries, seller listings and admin listing workflows.
- Email sign-up and sign-in with email verification, session lifecycle handling and profile setup.
- HDB address lookup with a short-lived verification token applied by a database trigger.
- Research valuation through an Edge Function and a FastAPI service on Render.
- Chatbot with deterministic anonymous onboarding, structured listing search, quotas and telemetry.
- Admin Monitoring dashboard: six views, on-demand Render readiness probe, model version comparison, on-demand valuation and chatbot synthetic checks, incident records with deduplication, and percentile latency with sample thresholds.

The repository roadmap in `SGHomie/docs/operations/monitoring-test-plan.md` lists alerting (Phase 8) and outside-in monitoring (Phase 9) as planned and not implemented.

## Not present at baseline

- Confirm password, show or hide password, forgot password, password reset page, authenticated password change.
- Any scheduled or outside-in service check. The dashboard's "Application" status is fixed text.
- Any staleness handling for monitoring evidence.

## Test tooling

| Area | Runner | Location |
| --- | --- | --- |
| Frontend and Edge Function logic | Node built-in test runner | `SGHomie/tests/*.test.mjs` |
| Valuation service | pytest | `MLPricePredictorV2/tests/` |
| Database policies and triggers | pgTAP through `SGHomie/tests/run-database-tests.py` | `SGHomie/BackEnd/supabase/tests/database/` |

Commands, run from `SGHomie/FrontEnd/` unless noted:

- `npm test`
- `npm run lint`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npm run build`
- From the repository root, one file: `node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/<file>.test.mjs`

## Continuous integration

- `.github/workflows/tests.yml` runs on every push and pull request. Jobs: `application`, `valuation`, `database`. The `database` job starts a disposable Supabase stack, applies every migration to a throwaway database and runs every pgTAP file.
- `.github/workflows/telegram-notify.yml` runs on every push to any branch. It sends the push diff to an external model provider for a summary and posts to a team chat. See `01-scope-and-decisions.md`, decision D6.
- There are no scheduled workflows and no deploy workflows.

## Environment limits

- Docker is not installed on the development machine. The local Supabase stack and the pgTAP runner cannot run locally. Database tests run only in the CI `database` job after a push.
- Local Node is v24.20.0. CI uses Node 22.22.2.
- No agent deploys, commits or pushes. The repository owner performs those steps.

## Baseline run

Performed locally on 16 November 2026 at `1986c1f`, with no changes in the working tree.

| Check | Result |
| --- | --- |
| Full Node suite | 439 tests, 439 passed, 0 failed, 0 skipped |
| `npm run lint` | Exit 0. 0 errors, 2 warnings (`react-refresh/only-export-components`) |
| `npx tsc --noEmit -p tsconfig.app.json` | Exit 0 |
| `npm run build` | Exit 0 |
| pytest | Not run in this session |
| pgTAP database tests | Not run. Cannot run locally. |

The two lint warnings predate the assessment.

## Hosted state

Nothing in this document verifies the hosted Supabase project, Netlify site or Render service. Earlier observations supplied by the repository owner:

- A test sign-up received a verification email and the confirmation link worked.
- A hosted chatbot synthetic check reported an authentication failure. The cause is not established. See `03-auth-and-security-plan.md`.
