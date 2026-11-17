# Planning session: implementer report and independent review (B1)

_Editor's note: the implementer's report for the B1 slice, followed by the planner's independent review and its own re-run of the checks._

### Implementer report (Claude Sonnet), delivered to the planner

Slice complete. All checks green, nothing staged, committed or deployed. I did not touch anything under planning/. The new tests were written first and failed as expected before the implementation.

**Files changed**
- `SGHomie/BackEnd/supabase/functions/admin-monitoring/index.ts`: in `runChatbotCanary`, the two `{ edge_reached: true }` overrides on the non-OK/missing-object path and the invalid-result path are removed, so `canaryFailure` default `false` applies. I added a short comment saying false means "execution not confirmed", not "did not run". Categories and statuses are unchanged. The valid-result path still sets `true`.
- `SGHomie/FrontEnd/src/components/AdminMonitoringV2.tsx`: Evidence string is now `Edge Function execution not confirmed`. The other two strings are unchanged.
- `SGHomie/tests/admin-monitoring.test.mjs`: new tests plus one helper edit (listed below).
- `SGHomie/tests/monitoring-dashboard.test.mjs`: one new test.
- `SGHomie/tests/chatbot-canary-route.test.mjs`: new file, 7 tests.

**Red run, before implementation** (focused command): 67 tests, 61 pass, 6 fail. The six failures were:
- the 401, 403 and 404 tests, each `actual: true, expected: false` on `edge_reached`
- the 200-without-`synthetic_canary` test, same assertion
- the non-UUID `request_id` test, same assertion
- the dashboard test: the regex `/Edge Function execution not confirmed/` did not match, and the view still showed "Check did not reach the Edge Function"

The route tests (13-19) passed before any implementation, as intended, since they pin current behaviour. The valid failure, valid unknown, valid success, timeout, non-admin, no-auth and extra-key tests also passed before the fix, because they pin behaviour that was already correct.

**Green run, after implementation**
- Focused: 67 tests, 67 pass, 0 fail.
- `npm test`: 597 pass, 0 fail (578 baseline + 19 new).
- `npm run lint`: 0 errors, 2 warnings (the existing ones).
- `npx tsc --noEmit -p tsconfig.app.json`: no output (clean).
- `npm run build`: built in 2.99s.

**CHECK constraint finding** (`20261031150000_phase7_synthetic_canary_runs.sql`)
- `edge_reached` is `boolean NOT NULL` with no CHECK tying it to status or category.
- The only cross-column CHECK (lines 30-31) is: success requires a null category and `canary_valid`, otherwise a non-null category is required.
- `AUTH_FAILURE`, `CHATBOT_EDGE_FAILURE` and `PROVIDER_TIMEOUT` are all in the category allow-list, and the stored statuses are `failure` or `unknown`.
- So `edge_reached = false` with those categories is valid. I checked this by reading the SQL only; I did not run it against a database.

**Changes to existing tests or helpers**
- `SGHomie/tests/admin-monitoring.test.mjs`, in the `fixture` helper's `fetch` stub, one line added immediately before the existing chatbot line: `if (String(url).endsWith('/functions/v1/chatbot') && options.chatbotFetch) return options.chatbotFetch(url, init);`. When the option is absent the stub behaves exactly as before.
- No existing test was edited, and none was weakened, skipped or deleted. The old string "Check did not reach the Edge Function" was not asserted anywhere, so no existing assertion changed.
- New tests were inserted before `test('synthetic check requests reject arbitrary types and writes fail closed'` in `admin-monitoring.test.mjs`, and before the valuation request details test in `monitoring-dashboard.test.mjs`.

**New tests**
- `admin-monitoring.test.mjs`: 401, 403 and 404 (3 tests); 200 with no `synthetic_canary`; 200 with a non-UUID `request_id`; valid success with `edge_reached: true`; valid failure `PROVIDER_UNAVAILABLE`; valid unknown `PROVIDER_TIMEOUT`; fetch timeout; non-admin 403 and no-auth 401 together; extra-key 400. Each case asserts the stored row and response body contain no key, prompt or reply text.
- `chatbot-canary-route.test.mjs`: 404 for no bearer, wrong bearer and user-style bearer (3 tests); identical 404 body for missing and wrong bearer; the configured key gives 200, `success`, one capacity reservation and only the fixed prompt sent to the provider; a body carrying `prompt` and `messages` still sends only the fixed prompt; the 200 body contains no prompt, reply or key.
- `monitoring-dashboard.test.mjs`: one new test for the Evidence wording.

**How the route test loads the function**
- It uses the existing pattern from `chat-telemetry-route.test.mjs`: it sets `globalThis.Deno`, imports `handleRequest`, and stubs `globalThis.fetch` with `t.mock.method`. No new harness code was needed.
- "Provider factory and capacity not called" is asserted as zero fetch calls of any kind. That covers the capacity RPC and the provider endpoint, but not the call to `createChatProvider` itself, since that makes no network call.

**Observation on `runValuationCanary` (no change made)**
- Yes. Line 187 of `admin-monitoring/index.ts` hard-codes `edge_reached: true` for every response that reaches that return. That includes non-OK 401, 403, 404, 409 and 5xx responses, and OK responses with an invalid schema.
- The only paths that do not claim it are the config and fixture early returns and the catch block.
- It is also reached for a non-OK 401 or 403 that never executed the valuation function, so it does not prove the function ran.

**Unverified**
- I did not call hosted Supabase or any provider, and did not start a dev server or a browser, so hosted behaviour and the real cause of the hosted `AUTH_FAILURE` remain unconfirmed.
- The schema acceptance of those rows is from reading the SQL only.
- Dashboard wording is verified through the existing component test harness, not a real browser.
- Existing observation outside this slice: `chatbot/index.ts` tests print `synthetic_chatbot_canary` log lines (request IDs only, no secrets) and a `MODULE_TYPELESS_PACKAGE_JSON` warning.

**Recommended commit message**
```
fix(monitor): report chatbot synthetic check edge_reached only on proven execution

Co-Authored-By: Claude Sonnet 5.5 <[email redacted]>
```
Body: set `edge_reached` false for non-OK, malformed and invalid chatbot responses. Show "Edge Function execution not confirmed" on the dashboard. Add admin-monitoring tests for 401/403/404, malformed and timeout paths. Add regression tests for the canary route authorization and fixed prompt.

### Planner (Claude Fable) · 2026-11-16T17:06:45Z

Sonnet has reported back on B1; I'm reviewing the diff and rerunning the checks myself.

### Planner (Claude Fable) · 2026-11-16T17:06:47Z

_[tool: Bash — Show B1 source diff and the new route test file]_

### Planner (Claude Fable) · 2026-11-16T17:06:48Z

_[tool: Bash — Show diff of changed existing test files]_

### Planner (Claude Fable) · 2026-11-16T17:06:55Z

_[tool: Bash — Run full tests, lint, typecheck, build and whitespace check]_

### Planner (Claude Fable) · 2026-11-16T17:07:09Z

The test summary lines didn't print; rerunning the suite to read the counts.

### Planner (Claude Fable) · 2026-11-16T17:07:12Z

_[tool: Bash — Rerun full Node suite and print its summary counts]_

### Planner (Claude Fable) · 2026-11-16T17:07:28Z

_[tool: Bash — Append B1 evidence and review findings to planning documents]_

### Planner (Claude Fable) · 2026-11-16T17:07:41Z

B1 is implemented, reviewed and accepted. It makes the dashboard honest about the failed check; it does not repair the hosted `AUTH_FAILURE`, whose cause is still unconfirmed.

#### What changed

- **Evidence flag:** in `admin-monitoring`, `edge_reached` is now true only when the chatbot returns a validated result object. A 401, 403, 404, malformed body or timeout leaves it false. Failure categories are unchanged, so no migration.
- **Dashboard wording:** the false case reads "Edge Function execution not confirmed" instead of "Check did not reach the Edge Function".
- **Route tests:** seven new tests cover the chatbot function's canary route (missing, wrong and user-style bearer get 404 with no provider call or capacity reservation; the request body cannot replace the fixed prompt; nothing sensitive in the response). They passed without any change to the chatbot function.
- **Stored results:** nothing is rewritten. Older rows may still carry the earlier, unproven flag.

#### Checks I ran myself

| Check | Result |
| --- | --- |
| Full Node suite | 597 of 597 passed (578 before, 19 added) |
| Lint | 0 errors, the same 2 existing warnings |
| Typecheck | passed |
| Build | passed |
| `git diff --check` | clean |

Sonnet's red run before the implementation: 6 of 67 focused tests failed, all on the flag or the wording. No existing test was edited; one optional hook was added to the `admin-monitoring` test helper.

#### Limitations

- **Stubs only.** No hosted call, provider call or browser check was made.
- **Not live until deployed.** The corrected flag needs `admin-monitoring` and the frontend deployed; I am not proposing a deployment yet.
- **Valuation check has the same flaw.** It marks the flag true for any response it receives, including a rejected one. I left it alone as out of scope; say if you want it fixed the same way.
- **Constraint check by reading.** I confirmed the stored rows remain valid from the migration SQL, not by running it.

#### Commit

```
fix(monitor): report synthetic check edge evidence only when execution is confirmed
```

Files to stage:

```
SGHomie/BackEnd/supabase/functions/admin-monitoring/index.ts
SGHomie/FrontEnd/src/components/AdminMonitoringV2.tsx
SGHomie/tests/admin-monitoring.test.mjs
SGHomie/tests/monitoring-dashboard.test.mjs
SGHomie/tests/chatbot-canary-route.test.mjs
planning/01-scope-and-decisions.md
planning/04-test-evidence.md
planning/05-review-findings.md
planning/handoffs/09-b1-canary-evidence-and-route-tests.md
planning/handoffs/11-c-monitoring-preparation.md
```

#### B2 is waiting on you

I can't go further on the diagnosis without the hosted evidence (read-only, no key values):

1. The chatbot function's own log for 17 Nov 00:38:20 to 00:38:30: is there a POST row, and with what status?
2. The deployed canary block from the chatbot Code tab, and `runChatbotCanary` from the deployed `admin-monitoring`.
3. The deployed version number and date of both functions.
4. On the API keys page: whether legacy JWT keys are enabled, and whether new secret keys exist.
5. Whether the hosted valuation check passes today.

`✶ Insight ─────────────────────────────────────`
- The fix was deleting two overrides, not adding logic: `canaryFailure` already defaulted the flag to false, and the old code went out of its way to assert something it couldn't know.
- The route tests passing unchanged is itself a finding. It means the repository's chatbot code behaves as designed, which pushes the hosted failure toward the platform or a deployment difference.
`─────────────────────────────────────────────────`

Once you send those five items I'll write up the confirmed findings and the authorization trade-offs for your decision before any B2 code is written.

_[end of excerpt]_
