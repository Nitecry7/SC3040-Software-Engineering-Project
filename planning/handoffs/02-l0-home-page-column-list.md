# Handoff 02: L0 home page explicit column list

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Date | 16 November 2026 |
| Budget | 30 minutes |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

The home page's featured listings request an explicit list of the columns they render, in place of every column. This must be in place before the public listing column contract (slice S2) can be applied to any database.

## Read first

- `AGENTS.md`
- `SGHomie/FrontEnd/src/components/FeaturedListings.tsx`
- The existing Node tests that cover the home page or this component, to copy their harness style.

## Step 1: test first

Add a Node test under `SGHomie/tests/` asserting that the featured listings query requests an explicit column list, that the list is not `*`, and that it contains only columns the component renders or needs as a key. Run it and confirm it fails for the intended reason.

## Step 2: change

Replace the broad select in `FeaturedListings.tsx` with the explicit list. Do not change what the component renders.

## Step 3: survey, read only

List every query on listings that can run without a signed-in user, with file and line, the exact columns selected and the columns used in filters or ordering:

- `SGHomie/FrontEnd/src/components/FeaturedListings.tsx`
- `SGHomie/FrontEnd/src/lib/listingCounts.ts`
- `SGHomie/FrontEnd/src/components/NotificationPanel.tsx`
- `SGHomie/BackEnd/supabase/functions/chatbot/onboarding.ts`
- `SGHomie/BackEnd/supabase/functions/_shared/listings.ts`, and whether its search can be reached without a signed-in user from `chatbot/index.ts`

Do not change these files. If one of them would need a change for anonymous callers to work with a restricted column list, report it and stop.

## Files you may change

- `SGHomie/FrontEnd/src/components/FeaturedListings.tsx`
- One new or existing test file under `SGHomie/tests/`

## Checks to run

From the repository root, the focused test:
`node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/<file>.test.mjs`

From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline before this slice: 439 Node tests pass, lint has 0 errors and 2 existing warnings, typecheck and build pass.

## Constraints

- Do not stage, commit, push or deploy.
- Do not weaken or delete any existing test.
- Paste real command output. Never report a result you did not observe.

## Report back

- Files changed.
- The red and green test output.
- Results of the four checks.
- The survey table from step 3.
- Anything unverified, and open questions.
- A recommended Conventional Commits message.
