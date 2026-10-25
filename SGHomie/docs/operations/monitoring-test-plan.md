# SG Homie monitoring and test plan

> **How do we know SG Homie's intended functionality is available, performant, correct and safe when real users are using it?**

**Initial version: 2026-10-26.** This is a living roadmap. Status labels describe repository evidence and do not confirm hosted behavior.

## Status key

- **Implemented** — present in repository code or tests; deployment still needs separate verification.
- **Existing** — a supporting endpoint, log or test is already present; this does not imply continuous monitoring.
- **Planned** — future work, not currently implemented.
- **Deployment-dependent** — depends on hosting, secrets, configuration or service state that must be checked in that provider.
- **Not yet verified** — evidence is insufficient to make a current claim.

## Monitoring dimensions

| Dimension | Operational question |
| --- | --- |
| Availability | Can users reach the component and complete its primary request? |
| Performance | How long does the user-visible operation and each service stage take? |
| Correctness / quality | Does the operation return valid, grounded and policy-compliant results? |
| Usage / capacity | What volume and concurrency does it handle, and where are its limits? |
| Security | Are authentication, authorization, data boundaries and abuse controls working? |

Do not publish a numerical service-level target or claim a metric until its source, collection method, period and environment are established. A single user-reported valuation observation recorded in the [Supabase serving notes](../../BackEnd/supabase/README.md) is not a current latency baseline or service guarantee.

## Component inventory

| Component | Current repository evidence | Availability / performance / error signals | Correctness / quality signal | Security signal |
| --- | --- | --- | --- | --- |
| Netlify frontend | **Deployment-dependent:** React/Vite source; no Netlify config in this repository | **Planned:** independent reachability, deploy status, browser errors and route timing | **Implemented:** frontend tests and build; hosted workflow checks remain **Not yet verified** | **Implemented:** public Vite-variable boundary documented; deployed headers/config **Not yet verified** |
| Supabase Auth | **Implemented:** session restore, sign-in/out and cross-tab SDK auth events | Hosted availability and Auth latency **Not yet verified** | **Implemented:** focused auth lifecycle tests | **Implemented:** registered-user gates in application; hosted auth settings **Deployment-dependent** |
| PostgreSQL and RLS | **Implemented:** migrations and policy-controlled data access | Hosted database availability and query latency **Not yet verified** | **Implemented:** focused policy/query tests where present; production data correctness **Not yet verified** | **Implemented:** RLS policies in source; hosted policy state **Deployment-dependent** |
| Supabase Edge Functions | **Implemented:** chatbot, valuation and HDB lookup functions | **Existing:** function logs/invocation views; service-wide alerting **Planned** | **Implemented:** request/schema tests; hosted version parity **Not yet verified** | **Implemented:** server-held secrets and authenticated paths in source; hosted secret/config state **Deployment-dependent** |
| Chatbot | **Implemented:** deterministic anonymous onboarding, authenticated AI paths and server-side quota reservations | **Existing:** request-correlation/stage logging where configured; quota event aggregation **Planned** | **Implemented:** buyer/seller authorization, grounding, flow and quota contract tests; actual database concurrency verification **Deployment-dependent** | **Implemented in repository / deployment not yet verified:** configurable tiers, per-user burst/daily quotas, provider-call reserve, abuse cooldowns and structured 429 handling |
| Buyer search tool | **Implemented:** structured, read-only search of approved listings | Query timing and error aggregates **Planned** | **Implemented:** filter and response tests; search is not personalized ranking | **Implemented:** registered-user server gate and read-only tool contract |
| Seller workflow | **Implemented:** verified-address intake and seller-owned draft path | Stage-level product health aggregation **Planned** | **Implemented:** seller role, write and HDB verification tests | **Implemented:** ownership checks and RLS; hosted policy state **Deployment-dependent** |
| HDB lookup | **Implemented:** postal-code lookup via Edge Function and authoritative HDB data | Lookup latency/error aggregates **Planned**; hosted uptime **Not yet verified** | **Implemented:** parser and verification tests | **Implemented:** seller-bound verification path and server-held OneMap credentials; deployed secret state **Deployment-dependent** |
| Valuation Edge Function | **Implemented:** authenticated property lookup, feature preparation and server-side Render call | **Existing:** correlated stage-duration logs; dashboards/alerts **Planned** | **Implemented:** schema and request tests; model outcome quality needs later labels | **Implemented:** caller auth/RLS and server-held Render token; hosted configuration **Deployment-dependent** |
| Render FastAPI | **Existing:** `/health`, model-info and prediction endpoints; Blueprint has auto-deploy off | **Existing:** health endpoint and service logs; independent uptime/error alerts **Planned** | **Existing:** health reports bundle readiness; prediction output tests exist | **Implemented:** prediction/model-info bearer auth in source; deployed state **Not yet verified** |
| CatBoost inference | **Existing:** versioned bundle, schema validation and inference-stage timing | Prediction success/latency by model version **Planned** | Output sanity now; drift, error and interval coverage need later labelled outcomes | **Implemented:** server-side inference and bundle verification; no browser-held artifact/token |

## Phase status

### Phase 1 — Chatbot access hardening

**Implemented** in the current repository: deterministic anonymous Buy/Sell onboarding, provider blocking for anonymous requests, structured buyer search and seller authorization boundaries. Deployment is separate and must be checked in Supabase. User reports Phase 1 was merged and deployed; this document does not independently verify hosted versions.

### Phase 2 — Session lifecycle

**Implemented** in repository source and focused tests: a 55-minute inactivity warning, 60-minute application sign-out, Stay signed in verification, cross-tab activity timestamp synchronization, wake/refresh deadline checks, and distinct manual, inactivity and unknown-session-end messaging. The browser lifecycle is a usability policy only. Supabase Auth, JWT validation, RLS and server-side authorization remain authoritative. Production timing and hosted behavior are **Deployment-dependent** until verified in the deployed frontend.

### Phase 3 — Chat capacity protection

**Implemented in repository; deployment and live database concurrency not yet verified.** One authenticated AI interaction reserves one user allowance before provider processing. Every outbound provider call reserves global capacity immediately before the call, so one buyer interaction may consume multiple global permits while using one user interaction. Anonymous deterministic onboarding, database listing reads, seller address checks and draft-only steps reserve neither quota. User reservations derive identity from `auth.uid()`; the global RPC is executable only by `service_role`. Quota state is bounded to one current row per user and one global row, rather than a request event history.

Initial configurable application policy is standard **2 interactions/minute and 5 per Singapore day**, tester **10/minute and 25/day**, and privileged **20/minute with no per-user daily cap**. All tiers remain subject to the same abuse controls and project reserve. Five burst denials in ten minutes start a 15-minute chatbot-only cooldown. Initial global policy is **18 provider calls/minute and 45/day**. These are operational defaults, not OpenRouter or OpenAI capacity guarantees; upstream limits can change and need independent verification. Daily boundaries are calculated by PostgreSQL in `Asia/Singapore`.

Tier assignment and limit changes use trusted SQL operations documented in the [Supabase setup guide](../../BackEnd/supabase/README.md). Admin or seller status does not change a quota tier. A user reaching an AI limit keeps access to Explore, Property Details, Profile, Enquiries and authorized seller features. Multiple legitimate accounts can evade per-user fairness limits; this phase does not add fingerprinting, CAPTCHA redesign or IP blocking.

After deployment, verify each tier with test accounts, exercise user and provider denials using temporarily lowered configuration in a non-production environment, and restore the settings. For concurrency verification, send simultaneous reservations for the same user with valid sessions at one request below the burst threshold and confirm no more than one succeeds; test global capacity through the Edge Function with a temporary low cap rather than exhausting an upstream account. Repository mocks and source assertions do not prove PostgreSQL transaction behavior. Verify the migration and deployed Edge Function independently before treating quotas as active.

Post-deployment acceptance should also confirm that standard and tester daily limits reset at Singapore midnight; privileged users still hit burst, cooldown and global limits; anonymous Buy/Sell remain deterministic without quota state; and a denied AI request leaves Explore, Property Details, Profile, Enquiries and authorized seller functions available. Verify `Retry-After`, reset timestamps and quota fields in both JSON and SSE responses. Restore temporary policy changes and record the deployed migration/function versions.

### Phase 4 — Chat telemetry, privacy and feedback

**Implemented in repository; deployment verification pending.** Migration `20261026140000_chat_telemetry_privacy_feedback.sql` adds `chat_interactions`, per-provider-call `chat_provider_calls`, and updatable `chat_feedback`. Each authenticated AI request receives a server UUID used as both interaction and request ID; a temporary frontend conversation UUID groups turns and changes on New Chat or account change. Anonymous deterministic onboarding, seller deterministic stages, and sensitive-input blocks do not create interaction rows.

Stored interaction metadata includes status/error category, requested and returned provider/model identifiers where safe and available, `chatbot-v1` prompt version, streaming flag, tool outcome/result count, quota tier/result, fallback state, available token usage, and total/provider/tool/application-first-output-event timings. A buyer turn can produce multiple child provider-call records. Provider calls that return no usage keep token counts null. `first_output_event_ms` is the time to the first non-empty application response event; it is not provider TTFT because current requests are buffered before SSE. Saved seller workflow content is omitted. Other stored user/assistant text is best-effort redacted; this does not guarantee anonymization or detection of every sensitive fact.

The registered-user notice explains temporary storage/review and third-party provider processing. Obvious credential, bearer/JWT, payment-card and Singapore NRIC/FIN patterns are blocked before user quota/provider calls; prices, postal codes and block numbers remain permitted. Feedback is attached to a successful interaction, uses one updatable rating, supports multiple structured negative reasons and an optional comment, and is evaluation data only—not automatic RLHF or model training. Direct Data API access to telemetry is denied; the authenticated feedback RPC checks ownership using `auth.uid()`. The service-only cleanup function clears redacted conversation text and feedback comments after their 30-day retention, closes stale started interactions, and removes account/conversation linkage when content expires. Metadata and opaque correlation IDs remain; feedback reason categories remain as metadata. Account deletion cascades while user linkage exists.

Repository tests exercise mocked Edge/PostgREST behavior and migration source assertions. They do not prove PostgreSQL RLS, `SECURITY DEFINER`, cleanup scheduling, or deployed state. Supabase Dashboard Cron scheduling is deployment-dependent and must be verified. After deployment, use test accounts to confirm JSON and SSE correlation, multiple provider/tool records, quota denials without provider calls, fake sensitive-input blocking without raw storage, thumbs-up and rating updates, two-account ownership denial, direct-table denial, and cleanup using an old synthetic fixture. Inspect Edge logs to confirm no raw text, credentials, tokens, or seller/unit details appear. Do not alter real user records to simulate retention.

### Phase 5 — LLM behavioral regression evaluation

**Planned.** Add fixed buyer/seller, tool-use, adversarial/prompt-injection, grounding and response-relevance cases. Compare prompt/model versions with deterministic assertions where possible and small human-reviewed samples where needed. Feed reviewed production failures back into the regression set without exposing secrets or unnecessary personal data. Evaluate stable behavioral invariants—not exact wording—including correct tool/filter choice, authorization, no fabricated listings or secret disclosure, and relevant responses.

### Phase 6 — Valuation and service monitoring

**Planned.** Monitor Render `/health`, loaded model/version, prediction success, Supabase-to-Render latency, FastAPI feature-preparation and CatBoost inference time, output-schema sanity and interval ordering, uptime/error rate, and a synthetic known-property canary. Separate cold-start from model-computation time. Future drift/quality analysis may track input-feature and prediction distributions, MAE/MAPE when later actual outcomes are labelled, and conformal coverage over newly labelled data. These outcome metrics cannot be calculated reliably for an unlabelled live prediction at request time.

### Phase 7 — Admin system-monitoring dashboard

**Planned.** Add a System Monitoring area using the existing React design system and chart libraries, with Overview, Services, Chatbot, Valuation, Security and Feedback sections. Candidate measures include service state, active alerts, request volume, p50/p95 latency, errors, fallback/tool success, serving-model mix, quota use, suspicious activity and feedback trends. Do not add Grafana or Sentry solely to imitate enterprise architecture.

Admin badge semantics: Manage Properties counts pending actions; Manage Enquiries counts unread/unresolved enquiries; System Monitoring counts active, unacknowledged warning/critical alerts. An alert remains active when viewed. The planned lifecycle is `active/unread → acknowledged → resolved`.

### Phase 8 — Alerting and Telegram

**Planned.** Send warning/critical incidents and recovery messages, with links to the Admin Dashboard, compact summaries, unresolved alert counts, useful pending-property/unread-enquiry counts and a daily digest. Avoid sending every low-level event. Use a dedicated monitoring bot and store its token only in server/GitHub secrets.

### Phase 9 — Outside-in monitoring

**Planned.** Use a scheduled external monitor such as GitHub Actions to check the production frontend, an intended Supabase application-health path and Render `/health`. An external monitor can report broad reachability if Supabase itself is unavailable; internal monitoring should explain the failure. Do not treat the minimal Render model-readiness endpoint as proof that the entire application works.

### Phase 10 — User-facing AI usage status

**Planned.** Show daily requests used/allowed, remaining requests, reset time, AI availability and serving model where reliable quota/model data exists. Keep quota display separate from LLM context-window capacity. Consider context-window display only after resolved-model limits and token usage are trustworthy.

## Phase 2 regression and release checks

The frontend lifecycle suite should use a fake clock and controllable storage; it must not wait in real time. Cover:

- Warning before/at/after 55 minutes, expiration at 60 minutes and delayed callbacks after sleep.
- Activity reset and persistence throttling; active-tab timestamp propagation to idle tabs; manual/idle cross-tab logout; stale-tab protection.
- Page refresh/reopen preserving elapsed inactivity; anonymous users and unresolved auth state receiving no idle UI.
- Stay signed in verifying the Supabase user, resetting the deadline and preserving route, search, chat and current work.
- ×/Escape closing the warning without extending the deadline; later activity resetting it.
- Manual sign-out success/failure, inactivity-specific sign-out and generic unknown session loss without duplicate route-guard toasts.
- Dialog focus entry, Tab/Shift+Tab containment, focus restoration, background inertness, readable error state, reduced motion and narrow-screen layout.

Before release, run focused Node tests, AuthContext/ProtectedRoute/chat tests, frontend lint, root and app TypeScript checks, the production build and `git diff --check`. For browser checks, enable only the development/test timing path; never alter the production 55-/60-minute constants to speed up a manual test. Record browser, viewport, test timing configuration and which multi-tab scenarios were actually exercised.
