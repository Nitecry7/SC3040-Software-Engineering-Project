# Preparation note 11: Phase C monitoring completion

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Repository owner, then Sonnet Medium once authorized |
| Date | 17 November 2026 |
| Status | Preparation only. Nothing here is implemented. |

No scheduling change is made until Phase B is repaired, reviewed and verified on hosted (decision D21). No runtime LLM investigator, Telegram alert or new dashboard panel.

## C1. Live targets for the existing monitor

The Level 1 runner (`.github/workflows/service-monitor.yml`) checks the frontend, Render model readiness and public chatbot onboarding. It makes no valuation request and no AI provider call. Its last CI run reported three targets as `NOT_CONFIGURED`.

Set these under repository Settings, Secrets and variables, Actions:

| Name | Kind | Value |
| --- | --- | --- |
| `MONITOR_FRONTEND_URL` | Variable | The Netlify site URL |
| `MONITOR_RENDER_URL` | Variable | The Render service base URL, no path |
| `MONITOR_SUPABASE_URL` | Variable | The Supabase project URL |
| `MONITOR_SUPABASE_ANON_KEY` | Variable | The publishable or anonymous key |
| `MONITOR_EXPECTED_MODEL_VERSION` | Variable, optional | The expected model version string |
| `MONITOR_TIMEOUT_MS` | Variable, optional | For example `60000`, to tolerate a Render cold start |
| `MONITOR_RENDER_TOKEN` | Secret, optional | The Render service token, only for the version check |

Verifying a real run:

1. On this branch, the workflow runs only on a push that touches a monitor path. Manual and scheduled runs exist only once the workflow is on `main`.
2. Read the job summary. Each target should show a status other than `NOT_CONFIGURED`.
3. Record the run URL, date and per-target result in `planning/04-test-evidence.md` as owner-reported or planner-observed, whichever is true.

Scheduled monitoring is described as active only after it is on `main` and a scheduled run has been observed.

## C2. Deep canaries: design options, not yet decided

Goal: run the valuation and chatbot synthetic checks a few times a day, separately from the 30-minute light checks.

### Fixed parts

- A separate workflow, `service-canaries.yml`, on a six-hour cron plus manual dispatch.
- Off unless the repository variable `MONITOR_DEEP_CANARIES` is `true`. That is the enable and disable control.
- One attempt per run, no retry. A timeout or network error is `unknown`, never `failed`.
- It calls `admin-monitoring`'s existing `run_canary` path, so quota reservation and result recording stay in one place.
- Cost at six hours: 4 chatbot provider calls and 4 valuation calls a day, each of which may wake Render.

### How the scheduled job authenticates

Ruled out by the owner: the owner's personal administrator session token, and an unrestricted service-role key.

| Option | Scope of the stored credential | Quota control | Audit | Cost |
| --- | --- | --- | --- | --- |
| 1. Dedicated monitor account with the admin flag; job signs in each run | Broad. An admin session can use every admin action, not only the checks. | Existing provider reservation only | Rows in `synthetic_canary_runs`; Auth sign-in log | No server change. A password in GitHub secrets. |
| 2. A dedicated canary secret accepted only by a narrow "run scheduled check" path | Narrow. It can start the two fixed checks and nothing else. | Existing reservation, plus a server-side minimum interval between scheduled runs | Rows in `synthetic_canary_runs`; function log event naming the scheduled source | Small server change, tests, one function deployment. A second way to start a check, which must be reviewed. |
| 3. Schedule inside Supabase (database cron calling the function) | No credential in GitHub at all | As option 2 | As option 2 | New database extension use and a migration that cannot be tested locally without Docker |

Planner's provisional view: option 2. It is the only one whose stored credential cannot do more than the job needs, and its limits are enforced on the server. Option 1 is simpler but stores a full administrator login. Option 3 adds infrastructure the project does not otherwise use.

This depends on Phase B. If the approved B2 repair introduces an internal credential between the two functions, the scheduled path should reuse that design, not add a third mechanism.

### Questions to settle before a handoff is written

- The B2 outcome and the authorization design it leaves in place.
- Whether a minimum interval of about five hours between scheduled runs, enforced from the latest stored result, is enough quota protection, or a daily cap is also wanted.
- Whether a scheduled result should be distinguishable from an on-demand one in the dashboard. Doing so in stored data needs a migration; the function log does not.
- Secret rotation: who rotates the canary secret and how both sides are updated.
