# Handoff 06: A1 password policy and strength meter

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Budget | 2 hours |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

The sign-up form shows which password rules are met and a live, advisory strength rating. An unmet rule blocks sign-up before any Supabase call. The policy and the meter are built once so that the reset-password and change-password slices can reuse them.

## Read first

- `AGENTS.md`, the frontend and accessibility rules.
- `SGHomie/FrontEnd/src/components/AuthModal.tsx`
- `SGHomie/tests/auth-modal.test.mjs`, `SGHomie/tests/auth-modal-guards.test.mjs`
- `SGHomie/tests/helpers/frontend-component.mjs`. Two facts matter: it rejects any import it was not given, and it does not render child function components. A child component appears as a node whose `type` is the function and whose `props` you can assert on.

## Policy

At least 8 characters, at least one lowercase letter, one uppercase letter and one digit. This mirrors the hosted Supabase Auth setting. Supabase stays the final authority.

Check Supabase's documentation (Context7 if available, otherwise the official password security page) for which characters count as lowercase, uppercase and digit, and match them exactly. Report what you found and the source.

## Files

New:

- `SGHomie/FrontEnd/src/lib/passwordPolicy.ts`: pure, no imports.
- `SGHomie/FrontEnd/src/components/PasswordStrength.tsx`
- `SGHomie/tests/password-policy.test.mjs`
- `SGHomie/tests/password-strength.test.mjs`

Changed:

- `SGHomie/FrontEnd/src/components/AuthModal.tsx`
- `SGHomie/tests/auth-modal.test.mjs`, `SGHomie/tests/auth-modal-guards.test.mjs`

No new dependency. No other file.

## `passwordPolicy.ts`

- `PASSWORD_RULES`: the four rules, each with a stable id and a label.
- `checkPasswordPolicy(password)`: returns each rule with a `met` flag, and an overall `valid`.
- `estimatePasswordStrength(password, context?)`: returns `{ rating: 'weak' | 'fair' | 'strong', level: 0 | 1 | 2 | 3 }`. `context.email` is optional. An empty password gives level 0.

Scoring rules. Each must be pinned by a test:

1. A password that fails the policy is `weak`.
2. Meeting the policy alone gives at most `fair`. An 8-character password that meets all four rules is never `strong`.
3. `strong` needs 12 or more characters, at least three character classes, and no penalty.
4. Penalties lower the rating: a short built-in list of very common passwords and base words (compared case-insensitively, after stripping trailing digits and symbols), keyboard runs, alphabetic or numeric sequences, a character repeated three or more times, a year-like suffix, and containing the email's local part.
5. `Password1` meets the policy and rates `weak`.

Keep the list short, a few dozen entries. This is an estimate, not a breach check. Do not claim more in comments or UI text.

## `PasswordStrength.tsx`

Props: `password`, `email?`, `id` (used for `aria-describedby`).

- Renders nothing when the password is empty.
- A three-segment bar: red for weak, amber for fair, green for strong. The bar is decorative (`aria-hidden`).
- A text label next to it: "Strength estimate: Weak", "Fair" or "Strong". Use dark text (for example `text-gray-700`), not coloured text, so contrast holds and colour is never the only signal.
- The label sits in one `role="status"` polite live region.
- A checklist of the four rules. Each item has an icon from `lucide-react` (`aria-hidden`) and visually hidden text saying "met" or "not met".
- Compact. Use Tailwind classes already used in the modal. No redesign.

## Modal changes

- Render the meter under the Password field in sign-up mode only, with `password`, `email` and an id. Link the password input to it with `aria-describedby` in sign-up mode.
- On submit in sign-up mode, check the policy first. If a rule is unmet: show an inline `role="alert"` message such as "Password does not meet the requirements.", keep the values, make no Supabase call, and do not set the loading flag. Then the existing mismatch check.
- Clear that message when the password is edited, on mode switch and on close.
- Sign-in mode must not apply the policy at all. Existing accounts may have older passwords.
- Confirm password, show/hide, the duplicate-send guard and every existing Supabase error path stay as they are. A `weak_password` error from Supabase must still reach the user through the existing handling.
- Never log, store or transmit the password outside the existing `signUp` call. Do not add `console` output.

## Edits to existing tests: only these

- Replace the fixture value `test-password` with a policy-compliant value (for example `Synthetic-Pass-2026`), including the literals that echo it in assertions at the same value.
- Add the new modules to the dependency maps the harness needs.

Any other change to an existing test: stop and report first.

## New tests, written first

Policy and estimator (`password-policy.test.mjs`), importing the TypeScript module directly as other tests in this folder do:

1. Empty string: no rule met, level 0.
2. One test per unmet rule.
3. A minimal compliant 8-character password is valid and not `strong`.
4. `Password1` is valid and `weak`.
5. One `fair` example and one `strong` example.
6. Each penalty lowers a rating that would otherwise be higher.
7. A password containing the email's local part is penalized.
8. Unicode letters and symbols behave as the documented character classes say.

Meter (`password-strength.test.mjs`), through the harness:

9. Renders nothing for an empty password.
10. Bar level, label text and checklist states for weak, fair and strong inputs.
11. The label is in a `role="status"` region, and each checklist item exposes its state as text.

Modal (added to the existing files):

12. Sign-up mode renders the meter with the current password and email. Sign-in mode does not.
13. Sign-up with an unmet rule shows the alert and does not call `signUp`.
14. Sign-in with a non-compliant password still calls `signInWithPassword`.
15. Policy failure and mismatch together: the policy message shows.
16. Toggling visibility and typing in Confirm Password still work with the meter present.
17. A compliant matching password calls `signUp` with the same arguments as before.
18. Typing a password causes no `console` call and no storage write.

## Checks to run

- Focused: `node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/password-policy.test.mjs ./SGHomie/tests/password-strength.test.mjs ./SGHomie/tests/auth-modal.test.mjs ./SGHomie/tests/auth-modal-guards.test.mjs`
- From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline: 472 Node tests pass. Lint has 0 errors and 2 existing warnings.

## Constraints

- Do not stage, commit, push or deploy. Do not start a dev server or a browser; the planner does the browser check.
- Do not weaken, skip or delete a test.
- Paste real command output. Never report a result you did not observe.
- Component tests run in a sandbox harness. They do not prove browser behaviour. Say so.

## Report back

- Files changed.
- Red then green output for the new tests, and the four check results.
- The character-class finding and its source.
- The common-word list size and the example passwords used for each rating.
- Every edit made to an existing test, line by line.
- Anything unverified.
- A recommended Conventional Commits message.
