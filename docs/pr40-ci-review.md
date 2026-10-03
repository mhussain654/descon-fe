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

## Review blockers resolved

- QVC scheduling now requires a returned `qvc_appointment` transition with no
  genuine prerequisite block, or current QVC action metadata and the latest
  no-show/re-medical attempt for supported follow-ups. Open attempts and an
  unresolved/failed attempts query suppress scheduling. Attempt history remains
  visible for processes without QVC actions.
- Generic transition dialogs now use the submission hook's selected stage.
  Success, stale state and missing prerequisites close the dialog and clear its
  evidence even when the same transition remains mounted after refetch. A fresh
  opening resets mutation errors and requires new evidence; recoverable failures
  preserve input for manual retry.
- Added 11 workflow panel regression cases. Updated legacy QVC fixtures to include
  explicit action metadata rather than relying on stage names.
- A follow-up CI failure in AI settings was a form-loading race: the save test now
  waits for the editable field instead of the immediately rendered page title.
