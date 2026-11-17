# Handoff 10: B2 chatbot synthetic check authorization

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Budget | 1.5 hours |
| Base | `247fa6b` (B1 committed) |
| Status | Approved by the repository owner. |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

The chatbot synthetic check is authorized by the administrator's own session, verified inside the chatbot function, instead of by the service-role key sent as a bearer. Only an administrator can start the check. The fixed prompt, the capacity reservation and the absence of stored text are unchanged.

## Background

On hosted, the check fails with `AUTH_FAILURE` in about 19 ms and the chatbot function records no invocation. The valuation check, which forwards the administrator's session token from the same function, passes. The cause of the rejection is not established. This change replaces the one request property that differs from the working check and that the function does not need. It is a repair attempt whose result on hosted is not yet known. Do not write, in code or comments, that the service-role key is invalid or rejected.

## Read first

- `AGENTS.md`
- `SGHomie/BackEnd/supabase/functions/admin-monitoring/index.ts`: `runChatbotCanary`, `runValuationCanary`, the `run_canary` action.
- `SGHomie/BackEnd/supabase/functions/chatbot/index.ts`: `corsHeaders`, `getAuthContext`, and the canary branch of `handleRequest`.
- `SGHomie/tests/chatbot-canary-route.test.mjs`, `SGHomie/tests/admin-monitoring.test.mjs` (the synthetic check tests), and one test that stubs an authenticated user for the chatbot, for example `SGHomie/tests/chat-telemetry-route.test.mjs`.

## Changes

### 1. `admin-monitoring/index.ts`

- `runChatbotCanary` takes the caller's `authorization` header value in place of the service key and sends it as `Authorization`, exactly as `runValuationCanary` does. The `apikey` header, the internal-action header, the empty body, the timeout and `redirect: 'error'` stay.
- The `run_canary` action passes `authorization`. By that point the caller is already verified as an administrator.
- In the existing `synthetic_canary` log event, add `upstream_status`: the numeric HTTP status of the chatbot response, or `null` when there was none. A number only. No header, body or token.

The upstream status is for the log only. Do not add it to the stored row or to the response sent to the browser. Find the simplest way to carry it from `runChatbotCanary` to the log line without changing the stored or returned result, and say how you did it.

### 2. `chatbot/index.ts`, the canary branch

Replace the bearer comparison with the administrator check:

- Call the existing `getAuthContext(req)`.
- If there is no verified user, or the user is not an administrator, return the same 404 response as today. This happens before the provider is built and before any capacity reservation.
- Otherwise run `runSyntheticChatbotCanary` as today. The capacity reservation still uses a service-role client created inside the function. If the URL or key is missing there, the existing `ChatQuotaUnavailableError` path applies.
- The service-role key is no longer accepted as a bearer on this route.
- Update the comment above the branch to describe the new rule.

Do not change `getAuthContext`. Confirm from its code, and state in your report, that every failure inside it (no header, token rejected, anonymous user, profile read error, missing profile row) yields `isAdmin: false`.

### 3. `chatbot/index.ts`, `corsHeaders`

Remove `x-sghomie-internal-action` from `Access-Control-Allow-Headers`. The frontend never sends this header, and server-to-server calls are not subject to CORS. First search the repository to confirm nothing browser-side sends it; if something does, stop and report.

## Owner requirements added on approval

- Status: approved by the owner (option B, with the CORS change). You may start.
- The internal-action header and the fixed prompt stay. The route never accepts a prompt from the caller and never runs without a verified administrator.
- CORS is not an authorization boundary. Say so in a short comment next to `corsHeaders`: the header is removed because no browser code needs it, and the administrator check is what protects the route.
- Ordinary chatbot requests and browser preflight must behave as before. The other allowed headers, the 204 preflight response and the public onboarding path are unchanged.
- In the comment above the canary branch, state that an administrator who calls this route directly is not recorded in `synthetic_canary_runs`, and that the global provider capacity reservation still applies. No new rate limiting.
- The only new diagnostic is the numeric upstream status. Never log a token, key, header value, request body or provider response.
- Do not describe the cause of the hosted failure as known, anywhere.

Additional tests:

18. An expired or otherwise rejected session token (Auth returns an error): 404, no reservation, no provider call.
19. `OPTIONS` still returns 204 and still allows `authorization`, `x-client-info`, `apikey` and `content-type`.
20. A request without the internal-action header and without a session still gets the public onboarding reply, as an existing test already shows; confirm that test passes unchanged and name it.
21. When the capacity reservation is refused for a verified administrator, the result is `unknown` with `GLOBAL_CAPACITY_LIMITED` and the provider is not called.
22. A verified administrator whose provider returns unexpected text gets `CANARY_VALIDATION_FAILURE`, and that text is not in the response.

## Out of scope. Stop and report if you think one is needed

- Any migration, new failure category, new secret or environment variable.
- Any change to `syntheticCanary.ts`, `getAuthContext`, the valuation check or `config.toml`.
- Any change to quotas.
- Any new dependency.

## Tests, written first

`chatbot-canary-route.test.mjs`. The existing tests in this file describe the old rule and change with it; this is an intended edit. List each one.

1. No `Authorization`: 404, no network call at all.
2. A bearer that Auth rejects: 404, no capacity reservation, no provider call.
3. A verified user whose profile has `is_admin: false`: 404, no reservation, no provider call.
4. A verified user whose profile read fails: 404, no reservation, no provider call.
5. A verified anonymous user: 404.
6. The service-role key as bearer: 404, no reservation, no provider call. This is the changed behaviour.
7. A verified administrator: 200, `status: 'success'`, one reservation, one provider call with only the fixed prompt.
8. A verified administrator with a body carrying `prompt` and `messages`: the provider still receives only the fixed prompt.
9. The 404 body is identical in cases 1, 2, 3 and 6.
10. The 200 body contains no prompt, no reply text, no key and no token.
11. The administrator lookup happens before the reservation and the provider call (assert the order of recorded calls).
12. An `OPTIONS` response does not list `x-sghomie-internal-action` in the allowed headers.

`admin-monitoring.test.mjs`:

13. The existing assertion that the chatbot request carries the service-role key (in the test "on-demand chatbot synthetic check is admin-only, fixed-input, persisted, and does not create incidents") becomes: it carries the caller's own `Authorization` value. Intended edit; change that one assertion only.
14. The chatbot request does not contain the service-role key in any header or in the body.
15. The `synthetic_canary` log event carries `upstream_status` 200 on success, 401 for a 401, and `null` on a timeout.
16. `upstream_status` is absent from the stored row and from the response body.
17. All B1 tests pass unchanged.

Every other existing test passes unchanged. Any other edit to an existing test: stop and report first.

## Checks to run

- Focused: `node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/admin-monitoring.test.mjs ./SGHomie/tests/chatbot-synthetic-canary.test.mjs ./SGHomie/tests/chatbot-canary-route.test.mjs ./SGHomie/tests/chat-telemetry-route.test.mjs ./SGHomie/tests/chat-onboarding.test.mjs`
- From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline: 597 Node tests pass. Lint has 0 errors and 2 existing warnings.

## Constraints

- Do not stage, commit, push or deploy. Do not start a dev server or a browser.
- Do not call hosted Supabase or any AI provider. Stubs and synthetic values only.
- Do not print or log any environment value, token or key.
- Do not weaken, skip or delete a test, other than the intended edits named above.
- Paste real command output. Never report a result you did not observe.

## Report back

- Files changed.
- Red then green output, and the four check results.
- The `getAuthContext` fail-closed finding, with line references.
- How `upstream_status` reaches the log without reaching storage or the browser.
- Every edit to an existing test, line by line.
- Anything unverified.
- A recommended Conventional Commits message.
