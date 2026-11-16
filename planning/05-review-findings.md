# Review findings

Independent reviews by the planning model of work produced by the implementation agent. Entries are added when a review happens.

## S1 step 1: database regression tests (16 November 2026)

**Reviewed:** `SGHomie/BackEnd/supabase/tests/database/hdb-verification-integrity.test.sql`, written by Sonnet at medium effort from handoff 01.

**Method:** read the full file against the handoff, the two existing trigger functions, the town centroid function and the conventions of `access-control.test.sql`. Nothing was executed. Docker is unavailable, so the file has not run anywhere yet.

**Result:** accepted for the first CI run. No changes requested.

| Check | Finding |
| --- | --- |
| Scope | One new file. No existing migration, test, frontend file or Edge Function was edited. |
| Plan count | `plan(38)` matches 38 assertions, counted by hand. |
| Conventions | Same transaction, role switching, claim settings and rollback as the existing database test file. New identifiers do not collide with it. |
| Coverage | All 13 tests in the handoff are covered, including one assertion per already-guarded column and three reverification cases. |
| Isolation | Writes that are expected to be rejected only after the fix each use their own row, so a write that succeeds today cannot disturb a later assertion. |
| Failure mode | Every write that may be rejected sits inside an assertion, so an unexpected result reports "not ok" and does not abort the file. |

**Expected first CI result, by reasoning only:** 7 assertions fail and 31 pass. The 7 are the ones that describe the new invariant. This is a prediction, not an observation.

**Unverified**

- Whether the file runs at all. A syntax or fixture error would appear only in CI.
- The fixture insert performed as a seller also fires the existing amenities trigger. The existing database tests never exercise a successful seller insert, so this path is untested. If it fails, later assertions fail for the wrong reason and the run is not a valid red result.
- How the trusted-write test resolves the signed-in user after the role reset. A wrong assumption would show as one failed assertion.

**Notes for step 2**

- The migration must keep the two existing error messages word for word. The tests match on them.
- The seller edit form resends the stored verification time. It is the same instant, so it does not count as a change today. The migration must not alter that comparison.
