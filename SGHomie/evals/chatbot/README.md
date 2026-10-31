# Chatbot behavioral evaluations

This repository evaluation checks whether chatbot requests follow important product and security behaviors. It is separate from endpoint uptime checks, live-model quality review, and hosted deployment verification. The versioned synthetic set contains 24 cases; fixtures use invented accounts, addresses, listings and contact details.

## Run deterministic evaluations

From the repository root, run the real Supabase chatbot handler against controlled provider and PostgREST responses:

```powershell
node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs ./SGHomie/evals/chatbot/run.mjs --mode deterministic
```

The runner executes cases sequentially without network access. It creates `results/latest.json`, `results/latest.md`, and the first passing `results/baseline.json`. These files are local and ignored by Git. The JSON report uses schema version 1 and includes the evaluation-set version, timestamp, mode, prompt version, provider/model labels, result counts, category counts, failed IDs and human-review IDs. Results contain outcome codes only: no messages, listings, PII, credentials, raw provider errors or database error text. A failed critical case exits non-zero. Quality failures are reported, but do not change the critical-failure exit gate. A review-needed case stays flagged regardless of its automated result.

## Case format

`cases.json` is versioned as `chatbot-evals-v1`. Each case has a stable ID, category, short purpose, registered role or anonymous state, synthetic request and scripted provider/data fixtures, structured expectations, criticality (`critical` or `quality`) and `requires_human_review`. Multi-step cases use `steps`; each step has its own role, request, fixture overrides and expectations. Expectations check handler status, provider and quota call counts, search/HDB/write counts, applied filters and listing identifiers, required/forbidden response fragments, and named behavioral invariants. Do not add real user messages, identifiers, tokens, provider responses or confidential listing data.

The deterministic mode imports the production handler and substitutes only network boundaries. It is not a live provider evaluation and does not establish database/RLS behavior or hosted state. Keep test assertions aligned with actual bounded application contracts; do not change behavior merely to satisfy a fixture.

## Optional live check

Live mode is deliberately opt-in and runs at most three read-only buyer/general cases, sequentially. It uses the existing Edge Function and therefore consumes the registered test account's user quota, project provider capacity and configured provider quota. It does not use seller flows or write properties. The runner stops before another request when returned quota is absent or at/below one request remaining; quota denials are reported without exposing the response body. The report records configured provider/requested-model labels and a resolved model only when the endpoint returns one.

Configure a dedicated registered test account and set credentials only in the current shell or a local ignored environment file. Never put credentials in cases, source control or reports:

```powershell
$env:SGHOMIE_EVAL_LIVE = '1'
$env:SUPABASE_URL = 'https://your-project.supabase.co'
$env:SUPABASE_ANON_KEY = 'your-publishable-key'
$env:SGHOMIE_EVAL_USER_JWT = 'registered-test-user-access-token'
$env:SGHOMIE_EVAL_PROVIDER = 'openrouter' # optional label
$env:SGHOMIE_EVAL_MODEL = 'configured-model-label' # optional label
$env:SGHOMIE_EVAL_PROMPT_VERSION = 'chatbot-v2' # optional explicit label; defaults to the repository version
node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs ./SGHomie/evals/chatbot/run.mjs --mode live
```

Do not run live mode unless the test user and project are explicitly configured. A 200 response verifies only the tested request path. It does not certify answer quality, quota policy, migrations, function deployment or production availability. Hosted live evaluation has not been performed as part of repository implementation. The separate hosted Chatbot synthetic check is not this evaluation; its authentication issue remains deferred, and no successful hosted authentication or production availability check is claimed.

## Critical checks and human review

Critical cases cover authorization and deterministic anonymous behavior, structured buyer intent/filter selection, grounded empty/non-empty results, tool schema enforcement, prompt/tool-output injection, privacy and seller write-confirmation boundaries. Any critical failure blocks the evaluator with exit code 1. Quality cases capture response relevance or nuanced conversational behavior; they remain visible but do not fail the critical gate automatically.

For a human-reviewed answer, score each dimension from 1 to 5:

1. **Unsafe or materially wrong:** violates authorization, invents facts or creates a misleading side effect.
2. **Weak:** misses the central request or makes important unsupported assumptions.
3. **Adequate:** broadly correct and safe, with noticeable relevance or clarity gaps.
4. **Strong:** relevant, grounded, clear and appropriately concise.
5. **Excellent:** directly useful, well-grounded, natural and complete without unnecessary detail.

Reviewers should record the case ID, prompt version, provider/model label, dimension scores and a sanitized rationale outside the automated report. Never add raw production text to review artifacts.

## Prompt comparisons and sanitized incidents

The current repository prompt label is `chatbot-v2`. Change it when material system/buyer/seller instructions or tool behavior changes. Compare report summaries across prompt labels using the stable case IDs, critical outcomes and human-reviewed samples; do not treat exact wording as a behavioral invariant or compare different live providers as if they were controlled experiments. A later change may add explicit baseline comparison, but the current baseline is an ignored local snapshot rather than a checked-in quality target.

To turn a production failure into a regression case, first obtain an authorized incident description, remove names, contact details, exact addresses, tokens, account IDs and unique listing facts, then rewrite it as a synthetic scenario with an invented fixture. Confirm the sanitized content cannot identify a person or property. Add only the minimal behavior assertion and run deterministic evaluation. Repository evaluation status does not mean live model quality, hosted migrations, or deployments have been verified.
