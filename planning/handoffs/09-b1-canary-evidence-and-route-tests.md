# Handoff 09: B1 synthetic check evidence and route tests

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Date | 17 November 2026 |
| Budget | 1 hour |
| Base | `1f8904f`, working tree holds only planning edits |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

A chatbot synthetic check result claims that the chatbot function ran only when the response proves it. The existing authorization of the route gets regression tests. The authorization itself does not change in this slice.

## Background

On hosted, the check fails with `AUTH_FAILURE` in about 19 ms. The cause is not confirmed. The dashboard showed "Request reached the Edge Function", but that flag is hard-coded for every non-OK response, so it proved nothing.

## Out of scope. Stop and report if you think one is needed

- Any change to how the route is authorized, in either function. The bearer that `admin-monitoring` sends stays as it is.
- Any migration, new failure category, or change to stored rows.
- Any change to `chatbot/syntheticCanary.ts` or to the valuation check.
- Any new dependency.

## Read first

- `AGENTS.md`
- `SGHomie/BackEnd/supabase/functions/admin-monitoring/index.ts`: `safeCanaryResult`, `canaryFailure`, `runChatbotCanary`, and the `run_canary` action.
- `SGHomie/BackEnd/supabase/functions/chatbot/index.ts`: `handleRequest`, the branch on `X-SGHomie-Internal-Action`.
- `SGHomie/BackEnd/supabase/functions/chatbot/syntheticCanary.ts`
- `SGHomie/BackEnd/supabase/migrations/20261031150000_phase7_synthetic_canary_runs.sql`, the CHECK constraints only.
- `SGHomie/tests/admin-monitoring.test.mjs` (the `fixture` helper and the three synthetic check tests), `SGHomie/tests/chatbot-synthetic-canary.test.mjs`, `SGHomie/tests/helpers/edge-function.mjs`.
- One existing test that calls the chatbot's `handleRequest`, for example `SGHomie/tests/chat-onboarding.test.mjs`, to see how the function is loaded and stubbed.
- `SGHomie/FrontEnd/src/components/AdminMonitoringV2.tsx`, the "Evidence" line, and `SGHomie/tests/monitoring-dashboard.test.mjs`.

## Changes

### 1. `admin-monitoring/index.ts`, `runChatbotCanary`

`edge_reached` is true only on the path where the response is OK, carries a `synthetic_canary` object, and that object passes the existing `valid` check. Every other path sets it to false:

- a non-OK status, including 401, 403 and 404;
- an OK response with no `synthetic_canary` object or an unparseable body;
- an object that fails the `valid` check;
- a timeout or network error (already false).

False means "execution not confirmed". It must never be described as "did not run". Say so in one short code comment.

Failure categories and statuses stay exactly as they are: 401 and 403 give `AUTH_FAILURE`, other rejected or malformed responses give `CHATBOT_EDGE_FAILURE`.

Check the table's CHECK constraints and confirm that a row with `edge_reached = false` and each of those categories is still valid. Report what you found.

### 2. `AdminMonitoringV2.tsx`, the Evidence line

The false case currently reads "Check did not reach the Edge Function". Change it to:

`Edge Function execution not confirmed`

The other two strings stay. This line is shared with the valuation check; the new wording is accurate for it too. No other UI change.

### 3. Tests only: the chatbot route

No test covers the canary branch of `handleRequest` today. Add a new file, `SGHomie/tests/chatbot-canary-route.test.mjs`, using the existing way of loading the function. These pin current behaviour and should pass without a change to `chatbot/index.ts`. If one fails, stop and report; do not change the function.

## Tests, written first

`admin-monitoring.test.mjs`, new tests. Extend the `fixture` helper only as far as needed to make the stubbed chatbot response configurable, and say what you changed:

1. Chatbot answers 401: stored row has `AUTH_FAILURE`, `status: 'failure'`, `edge_reached: false`.
2. Chatbot answers 403: the same.
3. Chatbot answers 404: `CHATBOT_EDGE_FAILURE`, `edge_reached: false`.
4. Chatbot answers 200 with a body that has no `synthetic_canary`: `CHATBOT_EDGE_FAILURE`, `edge_reached: false`.
5. Chatbot answers 200 with a `synthetic_canary` whose `request_id` is not a UUID: `CHATBOT_EDGE_FAILURE`, `edge_reached: false`.
6. Chatbot answers 200 with a valid failure result (for example `PROVIDER_UNAVAILABLE`): that category is stored, `edge_reached: true`, `upstream_reached` as supplied.
7. Chatbot answers 200 with a valid `unknown` result (`PROVIDER_TIMEOUT`): stored as `unknown`, `edge_reached: true`.
8. The fetch to the chatbot times out: `PROVIDER_TIMEOUT`, `status: 'unknown'`, `edge_reached: false`.
9. A caller who is not an admin gets 403 from `admin-monitoring`, no request is sent to the chatbot, and nothing is written.
10. A caller with no `Authorization` header gets 401, with no chatbot request.
11. Extra keys in the request (for example a `prompt` field) are rejected with 400 and no chatbot request.
12. In every case above, the response body and the stored row contain no key value, no prompt text and no reply text.

The existing success test must pass unchanged and already asserts `canary_valid`; add an `edge_reached: true` assertion in a new test, not by editing it.

`chatbot-canary-route.test.mjs`, new:

13. Canary header, no `Authorization`: 404. The provider factory and the capacity reservation are not called.
14. Canary header, a wrong bearer: 404, with the same two things not called.
15. Canary header, a user-style bearer that is not the configured key: 404, not called.
16. Canary header, the configured key, a stub provider that returns the expected reply: 200, `synthetic_canary.status` is `success`, capacity was reserved once, and the prompt sent to the provider is the fixed prompt.
17. The same, with a request body that carries `messages` and a `prompt`: the provider still receives only the fixed prompt.
18. The 200 response body does not contain the prompt, the reply text or the key.
19. The 404 body is the same for a missing and a wrong bearer.

If the function cannot be loaded with a stubbed provider through the existing harness, stop and report what is missing before building new harness code.

`monitoring-dashboard.test.mjs`:

20. A result with `canary_valid: false` and `edge_reached: false` shows "Edge Function execution not confirmed". If an existing test asserts the old string, changing that string is an intended edit; list it in your report.

Every other existing test passes unchanged. Any other edit to an existing test: stop and report first.

## Checks to run

- Focused: `node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/admin-monitoring.test.mjs ./SGHomie/tests/chatbot-synthetic-canary.test.mjs ./SGHomie/tests/chatbot-canary-route.test.mjs ./SGHomie/tests/monitoring-dashboard.test.mjs`
- From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline: 578 Node tests pass. Lint has 0 errors and 2 existing warnings.

## Constraints

- Do not stage, commit, push or deploy. Do not start a dev server or a browser.
- Do not call hosted Supabase or any AI provider. Stubs and synthetic values only.
- Do not print or log any environment value.
- Do not weaken, skip or delete a test.
- Paste real command output. Never report a result you did not observe.

## Report back

- Files changed.
- Red then green output for the new tests, and the four check results.
- The CHECK constraint finding.
- Every change to an existing test or test helper, line by line.
- One observation only, no change: in `runValuationCanary`, is `edge_reached: true` also set for responses that do not prove the valuation function ran? Give the line.
- Anything unverified.
- A recommended Conventional Commits message.
