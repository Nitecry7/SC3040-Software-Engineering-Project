# SG Homie deployment runbook

**Initial version: 2026-10-26.** This is a living operations guide. It describes repository configuration and expected service ownership, not proof of any current hosted deployment. Confirm each target project, branch, secret set, migration history and release in its hosting control plane before acting.

## Service ownership and status

| Service | Source and expected owner | Repository evidence | Hosted status |
| --- | --- | --- | --- |
| Frontend | `SGHomie/FrontEnd/` → Netlify; expected production branch `main` | React/Vite frontend; this repository has no Netlify deployment configuration | **Deployment-dependent / not verified.** Confirm the linked repository, production branch, build command, publish directory and environment variables in Netlify. |
| Auth and PostgreSQL/RLS | Supabase project | `SGHomie/BackEnd/supabase/config.toml`, migrations and Edge Functions | **Deployment-dependent.** Repository state does not show which project is linked, which migrations are applied, or which policies are hosted. |
| Edge Functions | Supabase Functions | `SGHomie/BackEnd/supabase/functions/` | **Explicit deployment required.** A Git merge does not deploy function code. Verify each function version in Supabase. |
| Valuation API | Render FastAPI service | Root `render.yaml` points to `MLPricePredictorV2/`, uses `/health`, pins the research bundle, sets `branch: faheem`, and has automatic deployment off | **Deployment-dependent.** The checked-in branch differs from the requested Netlify production branch expectation. Confirm Render’s linked branch and deployed commit in its dashboard. |

The valuation API is a research/demo service, not an approved production valuation system. Its `/health` endpoint reports minimal model readiness only; do not interpret it as an end-to-end application health check. See the [valuation service documentation](../../../MLPricePredictorV2/README.md) and the [Supabase serving notes](../../BackEnd/supabase/README.md).

The expected frontend workflow is for merges to the configured Netlify production branch (`main`) to trigger a frontend deployment. This trigger and branch are **Deployment-dependent** and cannot be confirmed from repository configuration; verify them in Netlify before relying on that workflow.

## Before a release

1. Confirm the intended repository, branch, commit and target environment. Check Netlify, Supabase and Render separately; never infer hosted state from Git.
2. Review the diff and run the relevant frontend, Edge Function and valuation checks locally. Keep generated valuation data and secrets out of the commit.
3. For Supabase schema work, compare local and linked migration history and preview pending changes before applying them:

   ```bash
   supabase migration list --linked
   supabase db push --dry-run
   ```

4. Review each migration and verify the linked project reference before an approved application. For a separately approved migration apply, use the documented `supabase db push --linked` workflow. Deploy Edge Functions explicitly and verify their versions after deployment:

   ```bash
   supabase functions deploy <function-name>
   ```

### Phase 3 chatbot quota rollout

The repository migration `20261026130000_chatbot_quotas_and_capacity.sql`
creates protected quota configuration, tier assignments and bounded usage
state. Review the migration and linked history, then apply it only through the
approved migration process above. Deploy the `chatbot` Edge Function after the
migration. The global reservation path uses Supabase's server-side
`SUPABASE_SERVICE_ROLE_KEY`; never add that key to Vite variables, client code,
or operator transcripts. Do not broaden RPC/table grants to make a deployment
work. The user RPC derives identity from the caller JWT; the provider-capacity
RPC remains `service_role` only.

After deployment, verify in Supabase that the migration is applied, the
`chatbot` function version contains the quota code, and no privileged key was
added to frontend environment settings. Use the trusted tier-assignment SQL in
the [Supabase setup guide](../../BackEnd/supabase/README.md) to promote a
project test account. For the privileged tier, copy the intended account's Auth
UUID from the target project's Dashboard and execute the documented statement
in Supabase SQL Editor after confirming the project and UUID. Verify the next
authenticated quota snapshot reports `tier: privileged`, a 20/minute user
limit and null daily limit/remaining values. `is_admin` does not assign this
tier. Deleting the account's assignment returns it to standard; setting it to
`tester` provides 10/minute and 25/day. Privileged users still share the
18/minute and 45/day project provider caps and the burst-denial cooldown.
Configuration edits must use a trusted database operator; ordinary accounts
must not be given table write access.

Use non-production test accounts for acceptance checks. Confirm standard burst
and daily denials, tester's higher limits, privileged's uncapped user daily
limit with bounded burst, repeated-burst cooldown and expiry, and anonymous
deterministic onboarding with no quota use. Verify Explore, Property Details,
Profile, Enquiries and authorized seller features after chat denial. To check
global denial safely, lower the application capacity in a non-production
database and invoke the chatbot; do not exhaust the provider account. Restore
the documented capacity values after the check. For database concurrency,
issue simultaneous user reservations with the same authenticated test JWT at
one below the configured burst limit and verify at most one succeeds; invoke
the service-only global reservation only from a secured test function. These
checks are post-deployment procedures, not evidence that hosted state has
already been verified.

5. Deploy the frontend using the configured Netlify workflow only after verifying its current production branch, build and publish settings. Those settings are not represented in this repository.
6. The Render Blueprint has `autoDeployTrigger: 'off'`; follow the approved Render deployment workflow. Check the expected model version and `/health` after any release. Do not copy secrets into a shell transcript, source file or Vite variable.
7. Verify the deployed frontend, auth, Edge Functions, database access and valuation path in the intended environment. Record what was actually checked and what remains unverified.

### Phase 6 valuation monitoring and synthetic canary

**Repository monitoring is implemented; hosted configuration and production checks are deployment-dependent.** At Phase 6, the valuation Edge Function and Render service wrote correlated structured timing events to their existing provider logs. Phase 7B later adds privacy-limited queryable Edge observations; Render-only timing history remains log-only and unavailable in dashboard aggregates. Timings are diagnostic measurements, not a latency target; the Edge `render_fetch_ms` covers the full HTTP fetch and must not be called network latency. Render `/health` confirms that the model bundle loaded, not that Supabase property access or an end-to-end estimate works. The Render `VALUATION_MODEL_VERSION` setting is checked against bundle metadata on startup; the repository Blueprint pins `hdb-catboost-2025-12-v1`.

After a separately approved release, verify the following without changing hosted data:

1. In the target Render service, confirm the deployed commit, `VALUATION_MODEL_VERSION`, required auth configuration and `/health`. Use the authenticated model-info endpoint to verify the loaded model version. `/health` is unauthenticated model readiness only.
2. Confirm the target Supabase valuation function version and its server-side Render URL/token configuration. If hosted canonical demo valuation is intended, verify `VALUATION_ALLOW_HOSTED_DEMO_INPUTS=true` and that the canonical synthetic seed fixture exists and is approved. Do not enable this gate merely to make the canary pass.
3. Set `SGHOMIE_CANARY_SUPABASE_URL`, `SGHOMIE_CANARY_SUPABASE_ANON_KEY`, `SGHOMIE_CANARY_USER_TOKEN` for a registered non-production test account, and `SGHOMIE_CANARY_EXPECTED_MODEL_VERSION` in a secure local environment; never put the user token in source, a report, or shell history. Run one read-only canary invocation:

   ```text
   node SGHomie/scripts/valuation-canary.mjs
   ```

   It uses one canonical synthetic property from `seed.sql`, times out after 150 seconds, writes no property data and exits nonzero if the path, model version, request ID, response schema or interval check fails. It does not retry and does not run automatically in CI. Its JSON output contains status, safe check results, model labels and correlation ID only.
4. Search the returned request ID in Supabase Edge Function logs and Render service logs. Confirm matching IDs, nonnegative timing fields, expected model version, prediction sanity passed, and no credentials, property IDs, features or prediction amounts in the events. Record the environment and timestamp; do not describe the result as accuracy validation.

Repository Node/Python tests and GitHub CI do not prove the hosted migration/function version, secrets, model state or canary result. Provider log APIs/export and controlled valuation-log aggregation still require a separate design. A canary is a synthetic serving-path check; accuracy and interval coverage need later outcome labels.

### Admin monitoring dashboard deployment boundary (Phase 7A)

The repository contains an admin-only `admin-monitoring` Edge Function and a System Monitoring tab under the existing `/admin` page. The function uses Supabase `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` server-side, plus `VALUATION_API_URL`, `VALUATION_SERVICE_TOKEN`, and optional `VALUATION_EXPECTED_MODEL_VERSION`. Keep these server settings out of frontend variables. The function independently verifies the user session and admin profile; repository configuration also sets `verify_jwt = true`.

The Phase 7A no-body request and response fields remain supported. Phase 7B adds a versioned `dashboard_v2` contract and requires its database migration; it does not deploy automatically. Deployment commands below are instructions only and have not been run.

Phase 7C adds an explicit `read_summary` action for persisted monitoring history without a Render probe, a range-aware `health_check` action for deliberate on-demand probing and incident evaluation, and a lightweight read-only `badge` action. Deploy the updated `admin-monitoring` function before the Phase 7C frontend. The frontend detects an older backend and displays an upgrade-required state. Verify that chart refreshes and range changes create no new `service_health_checks` records, while one deliberate health check creates one observation with source `admin_view`. Check the selected range is retained. The no-body Phase 7A request must remain compatible.

### Phase 7B monitoring data and API

**Implemented in repository; hosted migration, functions, and cleanup scheduling are unverified.** Migration `20261031120000_phase7_monitoring_data_api.sql` creates service-only `valuation_events`, `service_health_checks`, and `system_alerts`, protects them with RLS and restricted grants, provides the bounded aggregate/request-detail API support, and adds a service-only cleanup function. `valuation_events.request_id` is unique and duplicate writes are ignored. Alert uniqueness covers unresolved active/acknowledged incidents; resolved alerts can recur as a new incident. Alert resolution is manual. Recovery observations never silently resolve an incident.

The valuation Edge Function records safe operational metadata and measured Edge timings with best-effort background persistence. Failed writes emit `telemetry_persist_failed` with safe metadata only. Such signals are currently logs, not dashboard data; all dashboard counts mean recorded events and may undercount. The admin health check stores on-demand observations with source `admin_view`; an unavailable probe remains unknown and does not itself create an alert. The 90-day cleanup target applies to valuation events, health observations, and resolved alerts aged from `resolved_at`; unresolved alerts remain. Until a hosted schedule is verified, treat cleanup scheduling as **not verified**.

Percentiles use PostgreSQL `percentile_cont` on valid nonnegative finite values in the selected range. P50/P95/P99 require 5/20/100 valid samples independently for each timing and bucket. `1h` and `24h` are rolling ranges; `7d` is today so far plus six complete `Asia/Singapore` days; `30d` is today so far plus twenty-nine. Daily buckets begin at Singapore midnight and end their current-day bucket at query time. The Edge's Render fetch timer is the full outbound HTTP request duration, not network latency. Render internal, CatBoost, and conformal timing history remains unavailable. Monitoring is operational evidence, not model accuracy evidence.

For an approved future hosted rollout, preserve this order:

1. Review and apply the migration to the intended non-production Supabase project.
2. Verify all three tables, indexes, RLS/grants, functions, percentile/range behavior, alert lifecycle, and cleanup permissions in that project.
3. Deploy the updated `valuation` Edge Function.
4. Deploy the updated `admin-monitoring` Edge Function.
5. Verify Phase 7A no-body compatibility and authenticated Phase 7B actions/ranges/request detail.
6. Deploy the Phase 7C frontend only after the Phase 7B API is verified.
7. Generate controlled real traffic, then verify recorded valuation/chat metrics, safe request correlation, and percentile states.
8. Verify alert lifecycle with safe controlled conditions and verify cleanup scheduling separately; never infer scheduling from the function's presence.

For Phase 7C verification, inspect Overview, Services, Chatbot, Valuation, Security and Feedback at desktop and narrow widths. Confirm recorded-event labels, Singapore timestamps and Today-so-far buckets; accessible chart tables; insufficient-sample and unavailable states; safe request-ID details; manual acknowledgement/resolution; and a hidden monitoring badge on badge-read failure. Test a slow or failed refresh: previously displayed values and their original freshness time must remain visible. The hosted canary remains deferred. These are post-deployment checks, not evidence that the repository implementation is already hosted.

No migration, function, frontend deployment, hosted schedule, or hosted state change is part of this implementation. Telegram and outside-in monitor integrations remain later phases; the hosted synthetic valuation canary remains deferred.
### Phase 4 chatbot telemetry and feedback

**Implemented in repository; deployment verification pending.** Migration
`20261026140000_chat_telemetry_privacy_feedback.sql` adds protected interaction,
provider-call and feedback tables plus caller-owned feedback and service-only
content-cleanup RPCs. Follow-up migration
`20261026150000_redact_singapore_phone_feedback.sql` extends feedback-comment
phone redaction without editing the earlier migration. Apply both migrations in
timestamp order through the reviewed Supabase process, then deploy the `chatbot`
Edge Function for matching interaction-text redaction. Keep the service-role
key server-side; feedback uses the authenticated caller session.

The cleanup function clears redacted user/assistant text and written feedback
after 30 days, closes stale `started` interactions after one hour, and removes
user/conversation linkage when interaction content expires while retaining
metadata, structured feedback reasons and opaque interaction IDs. To schedule
daily cleanup, configure Supabase Dashboard Cron to execute
`SELECT public.cleanup_chat_content();` once per day. The migration does not
prove that a hosted schedule exists; verify the job in the target project. The
function is idempotent and can be run manually against a controlled test
fixture. Never modify real user records to simulate expiry.

After deployment, verify in a non-production project that JSON and SSE replies
return matching interaction/request IDs and the supplied conversation ID; each
actual provider attempt has one child row with only returned model/usage data;
buyer search outcome/count and quota metadata are recorded; quota denial remains
HTTP 429 and produces no provider call; a fake credential is blocked before
quota/provider use and is absent from stored content; feedback can be updated on
the same interaction; a second account cannot read, alter or rate the first
account's interaction; direct Data API access is denied; and an old synthetic
fixture is cleaned while metadata remains. Check function logs contain no raw
messages, credentials, authorization headers, or seller/unit details. These are
post-deployment procedures, not proof of current hosted state.

For phone-redaction smoke checks, submit only the synthetic Singapore test
fixtures documented in the [chatbot guide](../chatbot/README.md). Wait for the streamed response
to reach EOF, refresh the table view and sort by `created_at` before deciding an
interaction is missing. Confirm the single interaction row has redacted phone
text and a terminal status. Repeat in the same conversation, after Buy, and
after New Chat; each request ID should have one row regardless of conversation
ID changes. Structured `chat_telemetry_write` logs distinguish transient retry
success from persistent start/provider/finalization failures without including
raw messages or database error text. If start storage remains unavailable after
retry, chat continues and no row can be guaranteed; a persisted `started` row
whose final update fails is closed by scheduled cleanup after one hour.

## Safety and rollback

- Git merge does not automatically deploy every service. Supabase Edge Functions and migrations are separate operations; Render auto-deployment is disabled in the current Blueprint.
- Never run `supabase db reset` against a hosted project. It is for an explicitly local development database only. Do not edit an applied migration; use a new migration for schema changes.
- Stop if the linked Supabase project, branch, pending migration, service or environment is ambiguous. Resolve drift before applying changes.
- Keep Supabase service-role keys, provider keys, OneMap credentials, Render service tokens and artifact-release credentials in the appropriate server/hosting secret store. `VITE_*` values are browser-visible and must contain only values designed for public use.
- If a release fails, use the hosting platform’s reviewed rollback or redeployment path for that service. For schema changes, use a reviewed forward-fix migration where needed; do not reset production data to roll back.
- After rollback or recovery, verify the affected service and related integrations independently. Record the deployed version/commit and evidence; do not claim recovery based solely on a successful build.

## Verification record

For each release, record date, environment, source commit, services changed, migration/function/model versions, checks performed, observed result, rollback decision and unresolved follow-up. Redact project credentials, user data and request secrets from the record.
