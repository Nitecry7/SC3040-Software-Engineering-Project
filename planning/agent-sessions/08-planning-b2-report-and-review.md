# Planning session: implementer report and independent review (B2)

_Editor's note: the implementer's report for the B2 slice, with its failing and passing runs, followed by the planner's independent review. The implementer's own run is in file 10._

### Implementer report (Claude Sonnet), delivered to the planner

B2 is implemented, test-first, and every check passed. No `planning/` file was edited by me; the `planning/` modifications and `handoffs/12-...` were already in the tree. Nothing was staged, committed or deployed.

**Files changed**
- `SGHomie/BackEnd/supabase/functions/admin-monitoring/index.ts`
- `SGHomie/BackEnd/supabase/functions/chatbot/index.ts`
- `SGHomie/tests/admin-monitoring.test.mjs`
- `SGHomie/tests/chatbot-canary-route.test.mjs`

**Red, then green**
- Red (focused, `admin-monitoring.test.mjs` + `chatbot-canary-route.test.mjs`, before any implementation): tests 54, pass 40, fail 14.
  - The 14 failures are the edited admin-only chatbot test, 4 new admin-monitoring tests (header/key test plus three `upstream_status` cases), and 9 new route tests (service-key bearer, 404 body identity, admin success, body ignored, 200 body, ordering, OPTIONS, capacity refused, validation failure).
  - The route tests that failed only because the old bearer rule rejected the admin session. Tests 2–5 and 18 already returned 404 under the old rule, so they were green at that point and do not prove the new behaviour on their own.
- Green (full focused command: admin-monitoring, chatbot-synthetic-canary, chatbot-canary-route, chat-telemetry-route, chat-onboarding): tests 92, pass 92, fail 0.
- Checks from `SGHomie/FrontEnd/`:

| Check | Result |
| --- | --- |
| `npm test` | 609 tests, pass 609, fail 0 (baseline 597, so 12 net new) |
| `npm run lint` | 0 errors, 2 warnings (the existing ones) |
| `npx tsc --noEmit -p tsconfig.app.json` | no output, clean |
| `npm run build` | built successfully |

**`getAuthContext` fails closed** (`chatbot/index.ts`, unchanged)
- Every failure path yields `isAdmin: false`.
  - No `Authorization`, or no `SUPABASE_URL` or `SUPABASE_ANON_KEY`: lines 137–139 return `anonymousContext`, which has `isAdmin: false` (line 131).
  - Token rejected, no user, or `is_anonymous === true`: lines 146–149 return `anonymousContext`.
  - Profile read error: line 151 destructures only `data`, so `profile` is null, and line 160 `profile?.is_admin === true` is false.
  - Missing profile row (`maybeSingle` returns null): same line 160, false.
- It can still throw on a network exception. I wrapped the call in try/catch in the canary branch, so a throw returns the same 404.
- Tests 3, 4, 5 and 18 cover the non-admin, profile-error, anonymous and rejected-token cases.

**How `upstream_status` reaches the log only**
- `runChatbotCanary` gets a final parameter, `onUpstreamStatus: (status: number) => void`, and calls it with `response.status` right after `fetch` resolves. On a timeout or network error `fetch` throws first, so it is never called.
- The `run_canary` branch declares `let upstreamStatus: number | null = null` and passes `(status) => { upstreamStatus = status; }`.
- It adds `upstream_status: upstreamStatus` only to the `console.info` `synthetic_canary` event, after `persistCanaryResult`.
- The result object, `safeCanaryResult`, the DB insert and the JSON response are untouched.
- Tests 15 and 16 assert 200 / 401 / `null` in the log, and absence from the stored row and the response.

**Other code changes**
- `admin-monitoring`: `runChatbotCanary` now takes `authorization` instead of the service key. It sends `Authorization: authorization`, and the `apikey`, `X-SGHomie-Internal-Action`, `'{}'` body, 35 s timeout and `redirect: 'error'` stay. The `run_canary` branch passes `authorization`.
- `chatbot` canary branch:
  - It calls `getAuthContext(req)`; no verified admin returns the same 404 before the provider is built or capacity is reserved.
  - The service-role key is read only for the reservation client, so the existing `ChatQuotaUnavailableError` path applies if it is missing.
  - The comment above the branch states the new rule, that a direct admin call is not recorded in `synthetic_canary_runs`, that the global capacity reservation still applies, and that there is no new rate limiting.
- `corsHeaders`: `x-sghomie-internal-action` is removed from `Access-Control-Allow-Headers`.
  - A repository search (excluding `planning/`) found it only at that CORS line in the function source plus the sender and the receiving check, so no browser code sends it.
  - A short comment says CORS is not an authorization boundary and the admin check protects the route.
- No comment or test claims the hosted cause is known or that the service-role key is invalid.

**Edits to existing tests**
- `admin-monitoring.test.mjs`, in the test "on-demand chatbot synthetic check is admin-only, fixed-input, persisted, and does not create incidents": one line changed (test 13).
  - Old: `assert.equal(probe.authorization, `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);`
  - New: `assert.equal(probe.authorization, 'Bearer synthetic-user-session');`
  - `synthetic-user-session` is the caller's own `Authorization` value in that file's `request()` helper.
- `chatbot-canary-route.test.mjs`: the whole old rule is replaced, as the handoff intends. The old tests, all removed or rewritten:
  - The looped 404 test (no Authorization, wrong bearer, user-style bearer). It is replaced by tests 1 and 2; the old "wrong bearer" and "user-style bearer" cases both fed unverifiable bearers and are now the single case "Auth rejects the bearer".
  - "404 body is identical for a missing and a wrong bearer". Now test 9, extended to four callers.
  - "reserves capacity once and sends only the fixed prompt" with the service key. Now test 7 with an admin session.
  - "ignores a browser-style body". Same name, now with an admin session (test 8).
  - "200 body contains no prompt, reply text or key". Now also checks for the token (test 10).
- The `buildFetch` stub there now also stubs `/auth/v1/user` and `/rest/v1/user_profiles`. Tests 3, 4, 5, 6, 11, 12 and 18 to 22 are new.
- Test 20 is the existing, unchanged `chat-onboarding.test.mjs` test "anonymous gate: missing, JSON never constructs or calls provider". It passed unchanged in the green run. It sends no internal-action header and no session.
- No other existing test was edited.

**Unverified**
- Hosted behaviour is unverified: no hosted Supabase or provider call was made. This is a repair attempt whose hosted result is unknown.
- I did not run Deno's own typecheck. `upstreamStatus` is assigned inside a closure, so TypeScript may narrow it to `null` at the log line. That is harmless at runtime but unchecked.
- I did not send a real OPTIONS preflight from a browser.
- I did not use an `Origin`-header test beyond the handler-level OPTIONS check.

**Recommended commit message**
```
fix(monitor): authorize chatbot synthetic check with the verified admin session

Send the caller's session instead of the service-role key, verify administrator
status inside the chatbot function, drop the internal-action header from CORS,
and log the numeric upstream status only.
```
I am not adding a Co-Authored-By line myself since no commit was made.

### Planner (Claude Fable) · 2026-11-16T17:52:54Z

Sonnet has finished B2; I'm reviewing the source diff and rerunning the checks.

### Planner (Claude Fable) · 2026-11-16T17:52:55Z

_[tool: Bash — Show B2 source diff and admin-monitoring test diff]_

### Planner (Claude Fable) · 2026-11-16T17:52:56Z

_[tool: Read — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\SGHomie\tests\chatbot-canary-route.test.mjs]_

### Planner (Claude Fable) · 2026-11-16T17:53:06Z

_[tool: Bash — Run full tests, lint, typecheck, build and header usage search]_

### Planner (Claude Fable) · 2026-11-16T17:53:38Z

_[tool: Bash — Append B2 evidence and review findings to planning documents]_

### Planner (Claude Fable) · 2026-11-16T17:53:51Z

B2 is implemented, reviewed and accepted in the repository. It is not deployed, so the hosted check is not repaired yet and I have not rerun it.

#### What changed

- **`admin-monitoring`:** sends the caller's own session token to the chatbot function instead of the service-role key. The internal-action header, empty body and timeout are unchanged. The log event gains the numeric upstream status only.
- **`chatbot`:** the synthetic route now verifies the session and `is_admin` itself, before any capacity reservation or provider call. Missing, rejected, expired, anonymous, non-admin and service-key callers all get the same 404. The fixed prompt and capacity reservation are untouched.
- **CORS:** the internal header is removed from the allow-list, with a comment that CORS is not an authorization boundary. Preflight still returns 204 with the other four headers.
- **Code comment:** records that a direct admin call is not written to `synthetic_canary_runs` and that global capacity still applies.

#### Checks I ran myself

| Check | Result |
| --- | --- |
| Full Node suite | 609 of 609 passed (597 before, 12 net added) |
| Lint | 0 errors, the same 2 existing warnings |
| Typecheck | passed |
| Build | passed |
| `git diff --check` | clean |

Sonnet's red run before the implementation: 14 of 54 tests failed in the two changed files.

**Edits to existing tests, all intended:**
- The B1 route tests were rewritten for the admin rule.
- One assertion in the `admin-monitoring` tests changed from the service-role key to the caller's session value.

The existing anonymous onboarding test passes unchanged.

#### Risks and limits

- **Hosted result unknown.** No hosted or provider call was made. A pass after deployment will support the bearer explanation without proving the original cause.
- **Edge Function type-check not run.** Deno is not installed here, and the frontend typecheck does not cover the functions. They were exercised only through the Node tests.
- **Direct admin invocation** skips the stored record, as you accepted. It still appears in the chatbot function's log.
- **No per-administrator limit** on checks, on either path. Global provider capacity is the only limit.
- **`is_admin` protection** is defined in migrations and covered by a CI database test, but not checked on the hosted database.
- **One addition beyond the handoff:** Sonnet wrapped the admin lookup so a network error also returns 404. I accepted it; it fails closed.

#### Commit

```
fix(monitor): authorize chatbot synthetic check with the verified admin session
```

Files to stage:

```
SGHomie/BackEnd/supabase/functions/admin-monitoring/index.ts
SGHomie/BackEnd/supabase/functions/chatbot/index.ts
SGHomie/tests/admin-monitoring.test.mjs
SGHomie/tests/chatbot-canary-route.test.mjs
planning/01-scope-and-decisions.md
planning/04-test-evidence.md
planning/05-review-findings.md
planning/handoffs/10-b2-canary-authorization.md
planning/handoffs/12-b2-deployment-and-rollback.md
```

#### Before deployment

The order, compatibility table, acceptance and rollback are in [12-b2-deployment-and-rollback.md](../../planning/handoffs/12-b2-deployment-and-rollback.md). Three things are needed from you first:

1. **Commit and push, and let CI pass.**
2. **Download the hosted copies** of `chatbot` version 42 and `admin-monitoring` version 8 with the Supabase CLI, and compare them with the Git export in `sghomie-rollback-d520b64`. I can run the download if you approve it; it only reads from hosted.
3. **Confirm `admin-monitoring`'s hosted Verify JWT is on**, since deploying applies `config.toml`.

Then deploy `chatbot`, then `admin-monitoring`, then run the check once.

`✶ Insight ─────────────────────────────────────`
- The ordering test is the one that proves the security property: it asserts the Auth lookup and profile read happen before the capacity reservation and the provider call. The 404 tests alone would pass even if a reservation leaked first.
- Passing the upstream status through a callback keeps it out of the result object entirely, so it cannot reach the database or the browser by accident later.
`─────────────────────────────────────────────────`

Nothing is staged, committed or deployed; the next step is yours to authorize.

_[end of excerpt]_
