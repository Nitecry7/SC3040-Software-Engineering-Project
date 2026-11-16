# Handoff 08: S6 authenticated change password

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Date | 16 November 2026 |
| Budget | 1.5 hours |
| Base | `bd6eb6e` (A1 and S5 committed, CI passed, S5 verified end to end by the owner) |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

A signed-in user can change their password from the Profile page by entering the current password and a new one. The working reset-link flow from S5 must behave exactly as it does now.

## Decisions already made

- **No password history.** Changing X to Y and later Y back to X is allowed. Only "new equals current" is refused. Do not track or compare earlier passwords.
- **Supabase is the authority** on password validity. The frontend mirrors the minimum policy for early feedback only.
- **Hosted settings** "Secure password change" and "Require current password when updating" are both off, as reported by the owner. Do not assume otherwise and do not change any hosted setting.

## Part 1: wording fix in S5

In `SGHomie/FrontEnd/src/pages/ResetPassword.tsx`, the `same_password` message becomes exactly:

`Your new password must be different from your current password.`

Update the tests that assert the old wording. This is an intended change to tests written in S5.

Put the message in one shared place so the reset page and the new form use the same text. A named export from `lib/passwordPolicy.ts` is enough.

## Read first

- `AGENTS.md`, `PRODUCT.md` (design principles only)
- `SGHomie/FrontEnd/src/pages/Profile.tsx`, `SGHomie/tests/profile-workflows.test.mjs`
- `SGHomie/FrontEnd/src/pages/ResetPassword.tsx`, `SGHomie/tests/reset-password.test.mjs`
- `SGHomie/FrontEnd/src/contexts/AuthContext.tsx`, the `onAuthStateChange` handler
- `SGHomie/FrontEnd/src/lib/passwordPolicy.ts`, `components/PasswordStrength.tsx`
- In `SGHomie/FrontEnd/node_modules/@supabase/auth-js/src/`: `updateUser`, `signInWithPassword` and `signOut` in `GoTrueClient.ts`, and `UserAttributes` in `lib/types.ts`.

## Investigate before coding, and report

Use the installed client source and the official Supabase documentation or server source (Context7 if available). Give sources.

1. With "Require current password" off, what does the server do with a `current_password` field sent to `updateUser`? Ignored, or an error?
2. With that setting on, is a session created by a recovery link exempt from the current-password requirement? This decides whether the owner can turn it on without breaking S5.
3. What does "Secure password change" require of a session, and what error code does the client see when it is not met?
4. Does a password change sign out the user's other sessions?
5. In the installed client, does `signOut({ scope: 'others' })` remove the local session or emit `SIGNED_OUT` locally?
6. `signInWithPassword` for the already signed-in user: which events fire, and how does the existing `AuthContext` handler treat them? Confirm it does not restart the profile bootstrap, show the session-ended notice or unmount the Profile page.

If a finding contradicts the design below, stop and report before coding.

## Design

### `components/ChangePasswordForm.tsx` (new)

Props: `email` (the signed-in user's email).

Fields: current password, new password, confirm new password. One show/hide button for all three, same pattern and ARIA as the reset page. The A1 checklist and meter sit under the new-password field. `autoComplete` is `current-password` for the first field and `new-password` for the other two.

Submit, in this order. Each failed step stops, keeps the values and shows an inline `role="alert"` message tied to its field with `aria-describedby` and `aria-invalid`:

1. New password fails the policy: "Password does not meet the requirements."
2. New and confirm differ: "Passwords do not match."
3. New equals current: the shared `same_password` message. No network call.
4. Verify the current password: `supabase.auth.signInWithPassword({ email, password: current })`.
   - `invalid_credentials`: "Your current password is incorrect." on the current-password field.
   - Status 429 or a rate-limit code: "Too many attempts. Please wait a moment and try again."
   - Network failure (status 0, returned or thrown): "We couldn't reach the server. Check your connection and try again."
   - Anything else: a generic failure message.
5. Update: `supabase.auth.updateUser({ password: next, current_password: current })`, unless investigation question 1 shows the extra field causes an error with the setting off. In that case send only `password` and report it.
   - `same_password`: the shared message.
   - `weak_password`: Supabase's message.
   - `reauthentication_needed`: "For your security, sign in again or use Forgot password to change your password."
   - A missing or expired session (`session_not_found`, `session_expired`, status 401 or 403): "Your session has ended. Sign in again to change your password."
   - Anything else: a generic failure message.
6. On success: clear all three fields, hide the passwords, show a `role="status"` confirmation "Your password has been updated." Then call `supabase.auth.signOut({ scope: 'others' })` and ignore its failure, but only if question 5 confirms it leaves the local session alone. If it does not, skip it and report.

Other rules:

- One request sequence at a time. The submit button is disabled while it runs.
- Never log, store or transmit a password outside these two SDK calls. No `console` output.
- Do not touch the recovery state in `lib/authRecovery.ts`. This form has nothing to do with it.
- Do not add a new Auth event listener.

State plainly in a code comment that step 4 is a client-side check, and that the hosted "Require current password" setting is the server-side control.

### `pages/Profile.tsx`

Add a "Change password" section that renders the form with the signed-in user's email. Render it only when the user has an email. Keep the page's existing layout and classes. Do not alter the existing profile form or sign-out behaviour.

## Files

New: `components/ChangePasswordForm.tsx`, `SGHomie/tests/change-password.test.mjs`.

Changed: `pages/Profile.tsx`, `pages/ResetPassword.tsx`, `lib/passwordPolicy.ts` (the shared message only), `SGHomie/tests/reset-password.test.mjs` (wording), `SGHomie/tests/profile-workflows.test.mjs` (dependency-map entry and new tests only).

No new dependency. No change to `AuthContext.tsx`, `authRecovery.ts`, `supabase.ts`, Supabase configuration, migrations or Edge Functions. If you believe one of those must change, stop and report.

## Tests, written first

Form (`change-password.test.mjs`):

1. Renders three password fields, hidden by default, with the correct `autoComplete` values, and the meter under the new-password field.
2. The show/hide button is a non-submitting button with `aria-pressed`, and reveals all three fields.
3. Policy failure, mismatch and new-equals-current each block with the right message and make no SDK call.
4. Wrong current password: `signInWithPassword` is called once with the email and the current password, `updateUser` is not called, and the message is on the current-password field.
5. Rate limit, network failure and a generic verification error each show their message and do not call `updateUser`.
6. Success: `signInWithPassword` then `updateUser`, in that order, with the expected arguments. Fields are cleared, passwords hidden, confirmation shown.
7. `same_password`, `weak_password`, `reauthentication_needed`, session-ended and generic update errors each show their message and keep the values.
8. A second submit while one is running makes no extra call.
9. `signOut` is called with `{ scope: 'others' }` after success, and its failure does not change the success state. Skip if the design drops that call.
10. The form never calls `signOut` without that scope, and never touches the recovery state.
11. Nothing is written to `console` or storage.
12. X to Y, then Y to X, with a stub that accepts any password different from its current one: both succeed. X to X is refused client-side with no call.

Profile (`profile-workflows.test.mjs`):

13. The Profile page renders the form with the user's email.
14. It does not render the form when the user has no email.

Reset page (`reset-password.test.mjs`):

15. `same_password` shows the new wording. No test asserts the old wording any more.

Every other existing test passes unchanged. Any other edit to an existing test: stop and report first.

## Checks to run

- Focused: `change-password`, `reset-password`, `profile-workflows`, `auth-recovery`, `auth-modal`, `auth-modal-guards`.
- From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline: 559 Node tests pass. Lint has 0 errors and 2 existing warnings.

## Constraints

- Do not stage, commit, push or deploy. Do not start a dev server or a browser.
- Do not call hosted Supabase. No real sign-in, sign-up, password change or email.
- Do not weaken, skip or delete a test.
- Paste real command output. Never report a result you did not observe.

## Report back

- Answers to the six investigation questions, with sources.
- A recommendation on the two hosted settings, with the reasoning and any risk to S5.
- Files changed.
- Red then green output, and the four check results.
- Every edit to an existing test.
- Anything unverified.
- A recommended Conventional Commits message.
