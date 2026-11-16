# Handoff 01: S1 HDB verification integrity

> **Do not commit this file before the S1 migration is pushed.** It describes an unfixed issue in detail. See decision D11 in `../01-scope-and-decisions.md`.

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Date | 16 November 2026 |
| Budget | 1.5 hours |
| Starts when | The repository owner authorizes S1 |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

After any write by a signed-in user, a listing with `hdb_verified = true` carries location fields that match the verification that set them. A legitimate reverification to a new address updates every location field and both coordinates together.

## Background

Two `BEFORE` triggers on `public.properties` handle location:

- `apply_hdb_location_verification_trigger`, on every insert and update. It requires a valid token when certain columns change, then copies the token's address onto the row.
- `set_coordinates_trigger`, on insert and on `UPDATE OF location`. It falls back to a town centroid.

Postgres fires same-timing triggers in name order, so the verification trigger runs first.

The gap, traced from SQL and not executed:

- The verification trigger does not treat `location`, `town`, `built_year` or `detailed_location` as guarded columns. An owner can change them on a verified row with no token, and `hdb_verified` stays true.
- When `location` changes and coordinates do not, the coordinate trigger then replaces the verified coordinates with a town centroid. The verification trigger has already finished, so nothing rechecks the row.

Already enforced, and not part of this slice: an owner edit of an approved listing must set the status to draft or pending.

## Read first

- `AGENTS.md`, especially "Change Discipline and Data Safety".
- `SGHomie/BackEnd/supabase/migrations/20260917120000_hdb_verification_tokens.sql`
- `SGHomie/BackEnd/supabase/migrations/20261013130000_preserve_explicit_property_coordinates.sql`
- `SGHomie/BackEnd/supabase/tests/database/access-control.test.sql`, for fixture style, role switching and the existing assertions DB-13 and DB-16 to DB-20.
- `SGHomie/tests/run-database-tests.py`, to see how files are discovered and run.
- Client write paths: `SGHomie/FrontEnd/src/pages/SellerDashboard.tsx` around lines 620 to 790, and `SGHomie/BackEnd/supabase/functions/chatbot/index.ts` around lines 380 to 445.

## Files

You may create exactly two files:

- `SGHomie/BackEnd/supabase/migrations/<timestamp>_hdb_verification_location_integrity.sql`, with a timestamp later than `20261031150000`.
- `SGHomie/BackEnd/supabase/tests/database/hdb-verification-integrity.test.sql`

You may not edit existing migrations, existing tests, frontend code or Edge Functions. If the fix seems to need that, stop and report.

## Design

Use `CREATE OR REPLACE FUNCTION` for both trigger functions. Keep their signatures, `SECURITY DEFINER` setting and `search_path` as they are. Do not drop or rename triggers.

### `apply_hdb_location_verification()`

1. Keep the existing bypass for writes where `auth.uid()` is null.
2. Keep every existing guarded column.
3. On an update of a row where `OLD.hdb_verified` is true, also require a valid token when any of these change:
   - `location`
   - `built_year`
   - `detailed_location`
   - `town`, unless the new value equals `NEW.location`. See "Town tolerance".
4. Rows where `OLD.hdb_verified` is false keep today's behaviour for these four columns.
5. When a valid token is applied, keep writing the same columns as today, and also set `detailed_location` to the canonical value `Block <block_number> <street_name>` built from the token. Client-supplied text for this column is never trusted on a verified row.

### Columns already guarded

Confirmed by reading the current trigger, not by running it: for a signed-in user, a change to `postal_code`, `block_number`, `street_name`, `latitude`, `longitude`, `hdb_verified` or `location_verified_at` already requires a valid token. This slice keeps those guards and pins each of them with a regression test. The one indirect route to changed coordinates is the coordinate trigger, which this slice closes.

### Town tolerance

The seller edit form sends `town` equal to `location` on every save (`SellerDashboard.tsx` line 724). The trigger stores a null `town` when the lookup returned no town, with `location` set to `PENDING`. A strict guard on `town` would reject an ordinary price edit on such a row. Allowing `town` to equal the row's guarded `location` keeps that edit working and gives an owner no way to move the listing, because `location` itself is guarded.

### `set_location_coordinates()`

Never replace coordinates when `NEW.hdb_verified` is true and both coordinates are present. The existing fallback for unverified rows and for null coordinates stays.

### Decided: canonical `detailed_location`

The repository owner decided on 16 November 2026 that consistency takes priority over preserving client formatting.

- The seller dashboard already sends `Block <block> <street>`, so its listings are unchanged.
- The chatbot sends the lookup's display address, a different string. After this change, chatbot-created listings store the canonical form instead. This is an intended, visible change.

Before step 2, read both client paths and any Node test that asserts the stored or displayed address text. Report any test or screen that depends on the chatbot's current format. Do not edit them in this slice.

## Step 1: tests only

Write the pgTAP file. Follow the style of `access-control.test.sql`: one transaction, `plan(n)`, synthetic identities and rows, everything rolled back. Use new UUIDs that do not collide with the existing file. Insert fixtures before switching roles, then act as the seller with the same role and claim settings the existing file uses.

Fixtures you will need:

- Two sellers and one verified listing per case, created through a real token write so the trigger sets the verified state.
- Tokens for: the original address; a new address in another town; a new address in the same town; an address in another town whose coordinates equal the original token's.
- A verified listing whose token had an empty town, giving `location = 'PENDING'` and a null `town`.
- An unverified legacy listing inserted before switching roles.

Tests. Each one reads the stored row after the write, so it sees the result of both triggers.

1. An owner changing `location`, `built_year` or `detailed_location` without a token is rejected. Setting `town` to a value other than the row's `location` is rejected.
2. An owner changing price or description succeeds and the row stays verified.
3. An update that resends unchanged location fields succeeds.
4. A verified insert stores the token's postal code, block, street, location, town, built year and coordinates even when the client supplies different values, and stores the canonical `detailed_location` even when the client supplies other text.
5. After a permitted edit, coordinates are unchanged.
6. Reverification to a new address in another town: postal code, block, street, location, town, built year, latitude, longitude and `location_verified_at` all equal the new token's values, and `detailed_location` equals the canonical value for the new block and street.
7. Reverification to a new address in the same town: coordinates equal the new token's, not the old ones and not the town centroid.
8. Reverification with a token whose town differs but whose coordinates equal the old ones: coordinates remain the token's values, not the centroid.
9. A write with no signed-in user keeps the existing bypass.
10. The verified listing with a null `town` accepts a price edit that also sends `town` equal to `location`.
11. The unverified legacy listing keeps its current edit behaviour for the four columns.
12. On a verified row, an owner changing each of `postal_code`, `block_number`, `street_name`, `latitude`, `longitude`, `hdb_verified` and `location_verified_at` without a token is rejected. One assertion per column.
13. A token issued to another seller, and an expired token, are rejected on a verified row.

Some of these should pass before the migration, because they describe behaviour that must be preserved. State in your report which tests you expect to fail before the migration and why. The expected failures are 1, 8 and the `detailed_location` parts of 4 and 6. Check that expectation yourself.

Report the file as ready for a push that is expected to fail. Do not write the migration yet.

## Step 2: migration

Begin only after the repository owner confirms, from the CI TAP artifact, that the intended assertions failed. A fixture or syntax error is not a valid red result; fix the test file and ask for another run.

Then write the migration to the design above. Use neutral comments that describe the invariant, not the gap.

## Constraints

- Docker is unavailable, so you cannot run SQL. Say so in your report. Never state that a test passes.
- Database tests run only in the CI `database` job after the owner pushes.
- Do not stage, commit, push or deploy.
- After three CI cycles without a passing run, stop and report. The owner decides what happens next.
- All 128 existing pgTAP assertions must still pass. Check DB-13 and DB-16 to DB-20 against your migration by reading them.

## Report back

- Files created.
- For each test, what it proves and whether you expect it to fail before the migration.
- What you confirmed about the two client write paths, with file and line references.
- Anything you could not verify.
- Open questions.
- A recommended Conventional Commits message for the slice, worded neutrally so it does not describe the gap.

## Out of scope

- Single-use verification tokens.
- Any approval guard (SGH-03).
- Changes to the seller form or chatbot.
- The public listing contract (S2).
