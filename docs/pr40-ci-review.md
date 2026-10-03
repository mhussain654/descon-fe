# PR #40 CI repair and review

Reviewed head: `557e2414d56faa0e1d3028c3adca599f9f5872af`.
Backend contract: PR #58, `22a5a39526f2d2781ccff603199c555589786ad1`.

## CI failure causes

- Shared workflow assertions omitted `actionType`, `required`, transition
  `fields`, and process metadata introduced by the dynamic workflow contract.
- Web private-file tests omitted `VITE_API_BASE_URL`. The URL resolver correctly
  fails closed without an API origin; tests now explicitly configure and restore it.
- Admin queue tests expected filters to be visible before expanding Advanced
  filters and targeted markup from the previous layout. Updated assertions retain
  coverage of URL state, debounce, summary counts and pagination.
- The forbidden-page action is now labelled "Back to Candidates".

No production URL validation or action-routing fallback was weakened. Added
shared regression coverage for typed evidence, missing action metadata, variable
timeline order, optional stages, and provisional process metadata.

## Local verification

- Web full suite: 202 test files passed; 2,010 tests passed before the two added
  shared regressions. Both changed shared suites subsequently passed (90 tests).
- Mobile full suite: 131 suites passed, 1,266 tests passed, 24 existing skips.
  Both changed shared suites subsequently passed (90 tests).
- Web and mobile typechecks passed; web production build passed.
- `git diff --check` passed.

## Remaining review blockers

- `QvcPanel` offers scheduling based on staff permission and absence of an open
  attempt. `WorkflowPanel` always renders it, without gating scheduling by the
  backend's returned QVC action metadata. A process without a QVC stage can still
  display this action. Gate it by the process/transition contract while retaining
  supported re-medical/no-show rescheduling behavior and read-only attempt history.
- `GenericTransitionCard` owns its dialog's `open` state, but `submitDirect` only
  resets the hook's `pendingToStageCode` on success or stale/prerequisite errors.
  If the transition remains rendered after a refresh, its dialog can remain open
  with old input. Connect dialog state to the submission lifecycle and require
  renewed review after a stale response; keep input on recoverable failures.

Passing CI alone does not resolve these workflow review blockers.
