# Planning session: hosted evidence, two authorization designs and the owner's choice (B2)

_Editor's note: the owner reports hosted evidence and forbids one unsupported conclusion. The planner compares two authorization designs and recommends one. The owner approves it with eight further requirements._

### Owner

I have now completed the remaining G1b evidence collection.

Both legacy Supabase API keys, `anon` and `service_role`, are enabled. The newer publishable and secret keys also exist.

I have thoroughly checked the chatbot function's hosted Logs and Invocations around the failed checks. There are no matching chatbot invocation or execution log entries. Please stop requesting additional screenshots of the same logs.

The deployed function versions and relevant source code were already provided:

- chatbot: version 42, deployed 31 October 2026.
- admin-monitoring: version 8, deployed 31 October 2026.
- The relevant hosted authorization blocks match the repository's original implementation.
- Chatbot Verify JWT is disabled.
- The valuation synthetic canary passes.
- The chatbot synthetic canary continues to return AUTH_FAILURE.

The exact cause remains unconfirmed. Do not state that the legacy service-role bearer is definitely invalid, because Supabase supports legacy JWT credentials.

**Please now proceed to the B2 design decision.**

1. Review the evidence and current official Supabase documentation about nested Edge Function calls, authorization headers, legacy JWT keys, and platform-level rejection.

2. Compare preserving server-to-server-only authentication against forwarding the verified administrator's session JWT.

3. Verify that `user_profiles.is_admin` is protected by database permissions and RLS before considering direct administrator authorization.

4. Evaluate provider quota enforcement, direct invocation risks, monitoring audit records, credential exposure and deployment compatibility.

5. Recommend the smallest secure solution supported by the available evidence. If the cause cannot be established conclusively without a deployment, propose a minimal, reversible diagnostic change rather than another broad investigation.

6. Prepare the focused B2 Sonnet Medium handoff, regression tests, deployment order and rollback plan.

7. Do not deploy, modify hosted settings, run additional live canaries, or change Git state without my approval.

Do not repeat the completed evidence collection. Present the recommended B2 repair and any remaining decision I need to make so implementation can proceed.

### Planner (Claude Fable) · 2026-11-16T17:38:18Z

_[tool: ToolSearch — select:mcp__context7__query-docs,mcp__context7__resolve-library-id,WebSearch]_

### Planner (Claude Fable) · 2026-11-16T17:38:22Z

_[tool: Bash — Check function drift since deployment, is_admin protections and quota reservation]_

### Planner (Claude Fable) · 2026-11-16T17:38:28Z

_[tool: Bash — Check whether a database test pins admin-flag protection]_

### Planner (Claude Fable) · 2026-11-16T17:38:29Z

_[tool: mcp__context7__query-docs — Edge Function calling another Edge Function with service role key in Authorization header; verify_jwt disabled; 401 Unauthorized from gateway; legacy JWT keys v]_

### Planner (Claude Fable) · 2026-11-16T17:38:30Z

_[tool: WebSearch — Supabase Edge Functions calling another edge function from within a function 401 service role key Authorization verify_jwt false nested invocation]_

### Planner (Claude Fable) · 2026-11-16T17:38:43Z

_[tool: Agent — Read Supabase 401 discussion]_

### Planner (Claude Fable) · 2026-11-16T17:39:17Z

Research is done; I'm writing the B2 handoff and the evidence record now.

### Planner (Claude Fable) · 2026-11-16T17:39:21Z

_[tool: Bash — Check header usage, the admin escalation database test and chatbot imports]_

### Planner (Claude Fable) · 2026-11-16T17:39:48Z

_[tool: Write — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\planning\handoffs\10-b2-canary-authorization.md]_

### Planner (Claude Fable) · 2026-11-16T17:39:55Z

_[tool: Bash — Append owner-reported hosted evidence to the test evidence document]_

### Planner (Claude Fable) · 2026-11-16T17:40:16Z

My recommendation is to forward the administrator's own session token to the chatbot function and verify the admin flag there. The cause of the hosted rejection is still not established, so this is a repair attempt that also works as the diagnostic.

#### What the evidence supports

- The request was answered with 401 or 403 before the chatbot function ran (no invocation recorded, about 19 ms).
- A request from the same function to the valuation function, carrying an admin session token, passes.
- The two requests differ in three ways: the bearer, the target function and its Verify JWT setting, and one custom header.
- The official Supabase pages I read only describe a platform 401 when the built-in JWT check is on. None covers a rejection with it off, or one function calling another with a legacy service-role key.

I am not claiming the service-role key is invalid.

#### Options compared

| | A. Keep server-to-server only | B. Forward the admin's session token (recommended) |
| --- | --- | --- |
| Credential | A new shared secret, or the newer secret key on the `apikey` header as Supabase now documents | None new. The service-role key stops travelling between functions |
| Hosted configuration | A new function secret to set and rotate | None |
| Evidence it will pass | Untested path on this project | Same bearer type as the passing valuation check |
| Who can start a check | Only `admin-monitoring` | An administrator, also by calling the chatbot function directly |
| Code change | Larger: secret handling in both functions | Small: reuse the existing `getAuthContext` |

#### Risks of B, checked

- **`is_admin` protection:** a trigger blocks self-promotion, and row-level security limits updates to a user's own row. The database test DB-09 covers it in CI. This is what the migrations define; I have not checked the hosted database.
- **Direct invocation:** an administrator could call the chatbot route directly and skip the stored result. It still requires an admin session and runs only the fixed prompt. The chatbot's own log event still records it. To narrow this, the handoff removes the internal header from the chatbot's browser CORS allow-list; the frontend never sends it.
- **Quota:** the check reserves from the global provider capacity before the provider call, as today. There is no per-administrator limit, on either the current path or the new one.
- **Fail closed:** a missing header, rejected token, anonymous user or failed profile read all leave the admin flag false, which returns the same 404 as today before any reservation.

#### Diagnostic value

B changes one of the three differences and keeps the other two. The handoff also adds the upstream HTTP status (a number only) to the existing log event.
- **If the check passes after deployment:** the bearer was the difference.
- **If it still fails with no chatbot invocation:** the cause is the header or the platform, and the log will say whether it was 401 or 403.

#### Deployment and rollback, for when you authorize it

1. **Before deploying:** download the deployed source of both functions to a folder outside the repository as the rollback copy, and confirm `admin-monitoring`'s hosted Verify JWT is on. Deploying applies `config.toml`, which sets it on.
2. **Deploy `chatbot`** (version 43). Only the canary branch and the CORS list change.
3. **Deploy `admin-monitoring`** (version 9). This also carries the B1 flag fix.
4. **One** "Run Check" on the dashboard. Pass means Passed with a provider and model shown.

- **Between steps 2 and 3:** the check fails as it does now. Ordinary chat is unaffected.
- **Rollback:** redeploy each function from the downloaded copy. By Git history, the chatbot folder has not changed since the 31 October commit, so that commit is a second source.
- **Not needed:** no migration, no secret, no setting change. The dashboard wording from B1 reaches the site separately, when the frontend is deployed.

#### Prepared

- [10-b2-canary-authorization.md](../../planning/handoffs/10-b2-canary-authorization.md): the Sonnet handoff with 17 regression tests. It changes the existing route tests and one assertion in the `admin-monitoring` tests, as named, intended edits.
- [04-test-evidence.md](../../planning/04-test-evidence.md): your hosted findings recorded as owner-reported, root cause still unconfirmed. These two files are uncommitted.

#### Decisions for you

1. **Approve option B**, or choose A. On approval I start Sonnet on the handoff.
2. **Keep or drop the CORS change.** I recommend keeping it.
3. **Optional:** run a read-only query on hosted to confirm the `is_admin` trigger and policies exist there. I can write it.

`✶ Insight ─────────────────────────────────────`
- The original design put a database master key on the wire between two functions to prove "I am the monitoring function". The admin's own token proves something more useful: who asked.
- Changing one variable at a time is what makes the deployment informative. Swapping the bearer and dropping the header together would fix or fail without telling you which mattered.
`─────────────────────────────────────────────────`

Sources:
- [Edge Function 401 error response](https://supabase.com/docs/guides/troubleshooting/edge-function-401-error-response)
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Authorization headers](https://supabase.com/docs/guides/functions/auth-headers)
- [Migrating to new API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Discussion #42534](https://github.com/orgs/supabase/discussions/42534) (community thread; its resolution was the toggle being on, which does not match your project)

Nothing is staged, deployed or run against hosted; B2 implementation waits on your choice.

### Owner · 2026-11-16T17:49:42Z

I approve **Option B: Forward the administrator's session JWT and verify administrator privileges inside the chatbot function**.

I also approve keeping the proposed CORS change.

Please proceed with the focused B2 Sonnet Medium handoff and test-first implementation.

A few final requirements:

1. The chatbot must independently validate the JWT and check `is_admin` server-side before any provider call or capacity reservation. Missing, invalid, expired, anonymous and non-admin credentials must fail closed.

2. Keep the internal canary action header and fixed synthetic prompt. Do not accept arbitrary prompts or allow unauthenticated access to the privileged route.

3. Keep the CORS change, but document that CORS is not an authorization boundary. Ensure ordinary chatbot requests and browser preflight behavior remain unaffected.

4. Preserve global provider capacity enforcement. Document that a directly authenticated administrator can potentially invoke the route without creating an `admin-monitoring` database record. Do not introduce a major new rate-limiting system for this slice.

5. Record only the upstream HTTP status and safe diagnostic metadata. Never log session tokens, API keys, raw provider responses or sensitive request details.

6. A successful hosted check supports the bearer hypothesis but does not conclusively establish the original root cause. Keep the evidence wording accurate.

7. Add focused tests for authorization, direct invocation, unchanged fixed-input behavior, quota reservation, response validation and existing chatbot functionality.

8. Before deployment, prepare usable rollback copies of chatbot version 42 and admin-monitoring version 8, including any dependencies needed for restoration. Check the compatibility of the deployment sequence.

Have Sonnet Medium implement the changes and run the necessary tests. Fable should independently review them.

After implementation, provide the exact files changed, test results, risks, recommended commit message and staging list.

Do not stage, commit, push, deploy, alter Supabase hosted settings or run live provider checks without my approval.

Keep everything on `assessment/ncs-opspilot`. Begin B2 implementation now.

### Planner (Claude Fable) · 2026-11-16T17:49:52Z

_[tool: Edit — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\planning\handoffs\10-b2-canary-authorization.md]_

### Planner (Claude Fable) · 2026-11-16T17:49:54Z

_[tool: Edit — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\planning\handoffs\10-b2-canary-authorization.md]_

### Planner (Claude Fable) · 2026-11-16T17:49:59Z

_[tool: Edit — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\planning\01-scope-and-decisions.md]_

### Planner (Claude Fable) · 2026-11-16T17:50:06Z

_[tool: Agent — Implement B2 canary authorization]_

### Planner (Claude Fable) · 2026-11-16T17:50:21Z

_[tool: Bash — Export functions folder from the 31 October commit to a folder outside the repository]_

### Planner (Claude Fable) · 2026-11-16T17:50:41Z

_[tool: Write — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\planning\handoffs\12-b2-deployment-and-rollback.md]_

_[end of excerpt]_
