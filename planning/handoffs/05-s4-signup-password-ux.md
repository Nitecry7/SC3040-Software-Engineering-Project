# Handoff 05: S4 sign-up password experience

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Date | 16 November 2026 |
| Budget | 45 minutes |
| Starts when | The repository owner authorizes S4 |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

The sign-up form asks for the password twice and lets the user show or hide what they typed. Nothing else about authentication changes.

## Read first

- `AGENTS.md`, including the frontend and accessibility rules.
- `PRODUCT.md`, the sections on users and design principles only.
- `SGHomie/FrontEnd/src/components/AuthModal.tsx`
- `SGHomie/tests/auth-modal.test.mjs` and `SGHomie/tests/auth-modal-guards.test.mjs`, for the harness and the existing behaviour that must keep passing.

## Files you may change

- `SGHomie/FrontEnd/src/components/AuthModal.tsx`
- `SGHomie/tests/auth-modal.test.mjs`
- `SGHomie/tests/auth-modal-guards.test.mjs`, only to add tests

Do not add a dependency, a new component file or a validation library.

## Behaviour

### Confirm password

- Shown in sign-up mode only. Sign-in mode is unchanged.
- If the two passwords differ on submit, show an inline message next to the field, keep both values, and make no Supabase call.
- The duplicate-send guard and every existing message stay as they are.
- The confirm value is cleared wherever the password value is cleared today, including on mode switch and on close.

### Show or hide

- One control per password field, or one control for both. Choose the simpler option that fits the existing layout.
- It is a real `button` with `type="button"`, so it never submits the form.
- It is reachable by keyboard, has a visible focus style consistent with the modal, and has an accessible name that says what it will do. Its state is exposed with `aria-pressed` or an equivalent.
- Passwords are hidden by default, and hidden again when the modal closes.

### Not in scope

- Password strength rules. Supabase decides those. Keep the existing handling of its error messages.
- Forgot password, reset password, resend, or any change to the sign-up call's options.
- Any visual redesign. Use the modal's existing classes and spacing.

## Tests

Write them first, in the existing harness.

1. Sign-up mode renders a confirm-password field. Sign-in mode does not.
2. Mismatched passwords on submit show the inline message and `signUp` is not called.
3. Matching passwords call `signUp` exactly as today, with the same arguments.
4. Password fields start hidden. Activating the control shows them. Activating it again hides them.
5. The control is a non-submitting button with an accessible name and exposed state.
6. Switching mode or closing the modal clears the confirm value and hides the passwords.
7. Every existing test in both files still passes unchanged.

## Checks to run

- Focused: `node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/auth-modal.test.mjs ./SGHomie/tests/auth-modal-guards.test.mjs`
- From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline: 457 Node tests pass if S3 is present, 440 without it. Lint has 0 errors and 2 existing warnings.

## Constraints

- Do not stage, commit, push or deploy.
- Do not weaken, skip or delete an existing test. If an existing test must change because behaviour intentionally changed, stop and report before editing it.
- Paste real command output. Never report a result you did not observe.
- These are component tests in a virtual harness. They do not prove browser behaviour. Say so.

## Report back

- Files changed.
- Red then green output for the new tests, and the four check results.
- How the control is labelled and how its state is exposed.
- Anything unverified, including browser and screen-reader behaviour.
- A recommended Conventional Commits message.
