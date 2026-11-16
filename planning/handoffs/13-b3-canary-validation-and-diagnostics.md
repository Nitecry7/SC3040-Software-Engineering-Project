# Handoff 13: B3 synthetic check validation and diagnostics

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Date | 17 November 2026 |
| Budget | 1 hour |
| Base | `450d02b` (B2 committed and deployed) |
| Status | Approved by the repository owner on 17 November 2026, including the tolerance for cosmetic wrapping. |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

The chatbot synthetic check stops failing for cosmetic reasons, and when it does fail validation, the function log says why in safe, bounded terms. A response that is not the expected reply still fails.

## Background

On hosted the check now reaches the provider and returns `CANARY_VALIDATION_FAILURE`: the model returned non-empty text that was not exactly `SGHOMIE_CANARY_OK`. The text is never logged, so the reason is unknown. The configured model is `openrouter/free`, which routes to whichever free model is available, so the serving model varies between runs. The request allows only 16 output tokens.

## Scope

Only `SGHomie/BackEnd/supabase/functions/chatbot/syntheticCanary.ts`, the canary log line in `chatbot/index.ts`, and their tests.

Out of scope. Stop and report if you think one is needed:

- The normal chatbot's model, prompts or provider configuration.
- A separate model or a new environment variable for the check.
- `admin-monitoring`, the dashboard, the stored row, any migration or new failure category.
- Any change to authorization.

## Changes

### 1. Fixed prompt

Replace the prompt with one that leaves less room for decoration. Keep it a single user message:

```
Output only the following token. Do not add quotes, punctuation, formatting, reasoning or any other text.
SGHOMIE_CANARY_OK
```

### 2. Output limit

Raise `max_tokens` from 16 to 128. The reply itself needs only a few tokens, but some free models spend output tokens before the visible answer. `temperature: 0` and `stream: false` stay.

### 3. Validation

Add a pure, exported function that classifies the provider's text. It returns one of these and nothing else:

| Class | Meaning | Passes |
| --- | --- | --- |
| `exact` | The trimmed text is exactly the token | Yes |
| `wrapped` | The text is the token with only cosmetic wrapping: surrounding whitespace, straight or curly quotes, backticks, asterisks, underscores used as emphasis markers around the token, or one trailing full stop | Yes |
| `truncated` | The text is a non-empty proper prefix of the token | No |
| `contains` | The token appears inside other text | No |
| `unrelated` | Anything else non-empty | No |
| `empty` | No text | No |

Rules:

- Matching is case-sensitive. `sghomie_canary_ok` is `unrelated`.
- `wrapped` must not accept any extra word or sentence. `SGHOMIE_CANARY_OK!` followed by other text, or "Sure: SGHOMIE_CANARY_OK", is `contains`.
- Be careful that stripping emphasis underscores cannot remove the underscores inside the token.
- `canary_valid` and `status: 'success'` follow `exact` or `wrapped`. Failure categories are unchanged: `CANARY_VALIDATION_FAILURE` for `truncated`, `contains` and `unrelated`; `INVALID_PROVIDER_RESPONSE` for `empty` or a malformed response.

### 4. Diagnostics, log only

`runSyntheticChatbotCanary` returns its public result exactly as today, plus a separate diagnostics object that the caller logs and does not return in the HTTP response. Decide the simplest shape (for example a second property the route strips, or a callback as in B2) and say what you chose. The response body sent to `admin-monitoring` must be unchanged.

Diagnostics fields, all bounded:

- `validation`: one of the six classes above.
- `finish_reason`: `stop`, `length`, `content_filter`, `tool_calls`, or `other` for any other string, or `null` when absent.
- `served_model`: the `model` field of the provider response, passed through the existing `safeLabel` check, or `null`.
- `output_chars`: the length of the text as a number, capped at 9999.

Add these four to the existing `synthetic_chatbot_canary` log event in `chatbot/index.ts`. Never log or return the text itself, any part of it, the prompt, a key or a token.

## Tests, written first

`chatbot-synthetic-canary.test.mjs`:

1. The classifier: one case per class, plus each wrapper (double quotes, single quotes, curly quotes, backticks, triple backticks on separate lines, bold asterisks, trailing full stop, surrounding newlines) gives `wrapped`.
2. Not `wrapped`: a leading phrase, a trailing sentence, a different case, the token twice, the token with an inner character changed.
3. `truncated` for `SGHOMIE_CANARY_` and for `SGHOMIE`; not for the full token.
4. A wrapped reply gives `status: 'success'`, `canary_valid: true`, no failure category.
5. `contains`, `truncated` and `unrelated` give `CANARY_VALIDATION_FAILURE`; empty text gives `INVALID_PROVIDER_RESPONSE`.
6. The request uses the new prompt, `max_tokens: 128`, `temperature: 0`, `stream: false`. The existing test pins the old prompt and 16; changing those two values is an intended edit. Its `deepEqual` on the result must still pass unless you chose the "second property" shape, in which case say exactly what changed.
7. Diagnostics: `finish_reason` mapping including an unknown string to `other`; `served_model` rejected when it fails the label check; `output_chars` capped.
8. Neither the result nor the diagnostics contains the provider text, for a long unrelated reply containing a marker string.

`chatbot-canary-route.test.mjs`:

9. The route's HTTP response body has exactly the same keys as before this change.
10. The log event carries the four diagnostic fields and not the provider text. Capture `console.info` with the test runner's mock.
11. A wrapped provider reply gives a 200 with `status: 'success'`.
12. The fixed-prompt assertions in the existing tests move to the new prompt. Intended edit.

Every other existing test passes unchanged. Any other edit to an existing test: stop and report first.

## Checks to run

- Focused: `node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/chatbot-synthetic-canary.test.mjs ./SGHomie/tests/chatbot-canary-route.test.mjs ./SGHomie/tests/admin-monitoring.test.mjs`
- From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline: 609 Node tests pass. Lint has 0 errors and 2 existing warnings.

## Constraints

- Do not stage, commit, push or deploy. Do not call hosted Supabase or any AI provider.
- Do not print or log any environment value, token, key or provider text.
- Do not weaken, skip or delete a test, other than the intended edits named above.
- Paste real command output. Never report a result you did not observe.

## Report back

- Files changed.
- Red then green output, and the four check results.
- The shape chosen for diagnostics and proof that the HTTP response is unchanged.
- Every edit to an existing test, line by line.
- Anything unverified.
- A recommended Conventional Commits message.
