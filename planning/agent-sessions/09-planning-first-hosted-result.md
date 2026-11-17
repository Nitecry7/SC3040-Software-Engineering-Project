# Planning session: the first hosted result after deployment

_Editor's note: the owner deploys, runs one hosted check and reports the result. The planner states what the result does and does not show and proposes the last fix. The owner sets a stopping rule._

### Owner
_[image omitted]_

_[image omitted]_

_[image omitted]_

_[image omitted]_

_[image omitted]_



B2 has now been deployed to hosted Supabase, and I ran the chatbot synthetic check once.

We have made significant progress.

**Observed hosted results on 17 November 2026 at approximately 2:20 AM SGT:**

- Both `chatbot` and `admin-monitoring` Edge Functions were deployed.
- The chatbot synthetic check no longer reports AUTH_FAILURE.
- The chatbot function was invoked successfully and returned HTTP 200.
- The chatbot's own logs now contain a `synthetic_chatbot_canary` event.
- The Admin Monitoring dashboard reports `CANARY_VALIDATION_FAILURE`.
- Duration: approximately 4.2 seconds.
- Provider: OpenRouter.
- Configured model: `openrouter/free`.
- The valuation synthetic check continues to work.
- GitHub CI for B2 commit `450d02b` passed on its second attempt.

This supports that the B2 authorization repair works. It does not conclusively prove the original rejection mechanism.

**Next: One final focused canary reliability improvement**

Please inspect the actual `syntheticCanary.ts` validation logic and provider configuration.

I understand that `openrouter/free` randomly routes to available free models, and that the current canary expects the exact string `SGHOMIE_CANARY_OK` with a maximum of 16 output tokens.

Investigate whether the current failure could result from model output formatting, instruction-following differences or the token limit.

If useful, improve safe diagnostics using only metadata such as the actual upstream model, finish reason and a bounded classification of why validation failed. Do not store or log raw prompts, generated responses, credentials or private data.

Recommend the smallest reasonable fix that preserves the meaning of the synthetic check.

Consider:
1. A clearer fixed instruction.
2. A modestly increased output-token limit if justified.
3. Whether a specific free model would be more reliable than `openrouter/free` for this canary only.
4. Maintaining strict validation without incorrectly marking unrelated responses as successful.

Do not change the normal chatbot's model configuration unless there is a compelling reason.

Have Sonnet Medium implement any approved minimal change with regression tests, followed by Fable's independent review.

Do not redeploy or run another live provider check until I approve.

**Stopping rule**

This is our final planned troubleshooting slice. After one controlled redeployment and verification attempt, if the canary still fails for reasons that are not quickly resolvable, document the known limitation and move to NCS assessment closure.

**Assessment closure**

Please also prepare to transition directly into the final submission phase:

- Audit the NCS assessment requirements against our repository.
- Update the README, planning evidence, review findings and retrospective.
- Clearly separate implemented, CI-verified and hosted-verified functionality.
- Prepare the final demo sequence, recording script and submission checklist.
- Review readiness for merging the assessment branch into main, including Netlify, pending database migrations and monitoring scheduling.

Keep all work on `assessment/ncs-opspilot`.

Do not stage, commit, push, deploy or change hosted settings without my explicit approval.

Start by summarizing the B2 hosted verification evidence and proposing the smallest canary validation improvement.

### Planner (Claude Fable) · 2026-11-16T18:27:40Z

_[tool: Bash — Read chat provider configuration and OpenRouter client request handling]_

### Planner (Claude Fable) · 2026-11-16T18:27:43Z

_[tool: Read — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\SGHomie\BackEnd\supabase\functions\_shared\openrouter.ts]_

### Planner (Claude Fable) · 2026-11-16T18:28:12Z

_[tool: Bash — List planning documents and README headings]_

### Planner (Claude Fable) · 2026-11-16T18:28:26Z

_[tool: Bash — Record the owner-reported hosted B2 result in test evidence]_

### Planner (Claude Fable) · 2026-11-16T18:28:52Z

_[tool: Write — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\planning\handoffs\13-b3-canary-validation-and-diagnostics.md]_

### Planner (Claude Fable) · 2026-11-16T18:29:10Z

The B2 authorization repair works on hosted, but the check as a whole still fails, so the acceptance criterion is not met yet. I've recorded the result and prepared the handoff for the fix; it needs your approval before Sonnet starts.

#### B2 hosted evidence (your screenshots, recorded as owner-reported)

| | Before B2 | After B2 |
| --- | --- | --- |
| Dashboard result | `AUTH_FAILURE`, 19 ms | `CANARY_VALIDATION_FAILURE`, 4.2 s |
| Chatbot invocation | None | One POST, HTTP 200 |
| Chatbot log | Nothing | One `synthetic_chatbot_canary` event |
| Provider and model | Unavailable | OpenRouter, `openrouter/free` |

This supports the bearer explanation without proving why the earlier request was rejected. The CI first-attempt failure is noted in the evidence file without a cause, since I don't know it.

#### What the new failure means

In `syntheticCanary.ts`, `CANARY_VALIDATION_FAILURE` has one meaning: the provider returned non-empty text that was not exactly `SGHOMIE_CANARY_OK` after trimming. An empty reply would have been a different category. The text is never logged, so I can't tell which of these happened:

- **Formatting:** the token wrapped in quotes, backticks or bold, or followed by a full stop.
- **Truncation:** 16 output tokens may not fit the token plus anything a model emits first.
- **Instruction-following:** a preamble or explanation around the token, or something else entirely.

`openrouter/free` routes to a different free model per request, so the behaviour can vary run to run.

#### Proposed fix

1. **Clearer prompt:** one user message telling the model to output only the token, with no quotes, punctuation, formatting or reasoning.
2. **Output limit 16 to 128:** the reply needs few tokens, but some free models spend output tokens before the visible answer.
3. **Validation stays strict, with one tolerance:** pass on the exact token, or the token with cosmetic wrapping only (whitespace, quotes, backticks, bold markers, one trailing full stop). Case-sensitive. The token inside other text, a truncated token, or anything else still fails.
4. **Safe diagnostics in the chatbot log only:** a validation class (`exact`, `wrapped`, `truncated`, `contains`, `unrelated`, `empty`), the finish reason from a fixed list, the served model label, and the output length as a number. No generated text, prompt or credential.

No change to the normal chatbot, `admin-monitoring`, the dashboard, the database or any setting. Only `chatbot` would need redeploying.

**Keep `openrouter/free` for the check.** Pinning a specific model would make the check pass more often, but it would stop testing the path your users actually get, and it needs a new setting. If the redeployed check still fails, the diagnostics will say why, and that becomes the documented limitation under your stopping rule.

Because the free router varies, one passing run will not prove the check is stable, and one failing run will not prove the fix is wrong.

#### Decisions for you

1. **Approve the fix as proposed**, or adjust it. The main choice is the tolerance in point 3: accept cosmetic wrapping (my recommendation) or keep exact-match only and rely on the prompt and token limit.
2. **The official NCS brief:** it isn't in the repository. I'll audit against the deliverables you've named unless you paste the brief or its criteria.

The handoff is [13-b3-canary-validation-and-diagnostics.md](../../planning/handoffs/13-b3-canary-validation-and-diagnostics.md). It and the evidence update in [04-test-evidence.md](../../planning/04-test-evidence.md) are uncommitted.

On approval I'll start Sonnet on this slice and draft the closure documents in parallel: the README assessment section, retrospective, demo script, and the submission and merge-readiness checklist.

`✶ Insight ─────────────────────────────────────`
- The failure category already narrowed things: the code separates "empty reply" from "wrong reply", so we know the model said something. The gap is that nothing records what kind of wrong it was.
- Classifying into a fixed list is how you get diagnostics without logging model output. Six labels and a length can't leak content, yet they distinguish every hypothesis above.
`─────────────────────────────────────────────────`

Nothing is staged, deployed or run against the provider.

_[end of excerpt]_
