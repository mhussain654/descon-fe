# Mobile documents redesign

Continues the consent design on `feat/mobile-consent-redesign`: compact blue
brand header, document illustration, rounded pale-blue content area, colorful
summary tiles and document icons, status labels on collapsed cards, and matching bank
details card. English and Urdu use existing fonts and physical RTL alignment.
View/download controls have 44-point touch targets. No new dependencies.

The full authenticated backend checklist is displayed in backend order, including
optional requirements. Common documents remain available alongside the assigned
country's additional requirements; there is no client-side country/craft filter
or invented upload configuration. Upload rules, replacement permission, PCC dates,
file access, review submission, offline/retry and session behavior remain server
controlled. A regression test covers all eight common documents plus a country
addition, including an optional common requirement's upload action.

As confirmed, uploads remain for assigned candidates. Backend document storage
requires an assignment; unassigned candidate uploads are outside this change.
The backend's seeded configuration provides common documents for every country,
adds GAMCA/Wafid for Saudi Arabia, and PCC/polio for Qatar, with the Qatar driving
licence restricted to drivers. These rules depend on deploying/seeding the backend
configuration; the frontend does not substitute a static checklist.

Country was already validated as mandatory when creating a candidate by the web
form and backend. It now also has the native required attribute, accessible
required state, and a localized visible Required marker in the creation form.

Verification: mobile typecheck, all 131 Jest suites (1271 passed, 24 skipped),
web typecheck, all 202 Vitest files (2023 tests), web build, and diff whitespace
check. Native-device visual QA at small/large English and Urdu font sizes remains
outstanding because this workspace has no native emulator.

## Card and passport follow-up

Collapsed cards show the document name and status without Upload/Replace labels.
View/Download actions (including each file of a multi-file document) appear only
after expanding the card. The arrow points down while expanded, and assistive
technology receives the expanded state. Photo is the shorter mobile title for
the photograph requirement; its backend code and upload rules are unchanged.

Passport opens with a single combined PDF slot when the backend permits it.
Switching to separate photos shows Page 1 and Page 2 and accepts the configured
image/file types. Switching back shows one PDF slot. Tapping the already-selected
mode preserves selected files; switching modes clears the previous selection.
Mode controls have at least 44-point touch targets. Regression tests submit both
the combined PDF and separate page files with their correct part labels.

Follow-up verification: all 131 mobile suites pass (1273 tests, 24 skipped),
all 202 web suites pass (2023 tests), typechecks and web build pass.
The focused documents suite has 59 passing tests. Native device QA is still
needed to confirm touch behavior on the user's physical phone.

Uploaded cards reveal View, Replace and Download. Replace is disabled when the
backend locks it and opens the replacement form only when selected. A multi-file
document shows the same three actions; View or Download then reveals labelled
file actions so every page remains accessible.

Action styling follow-up: View uses blue, Replace amber, and Download green,
with dark labels on pale backgrounds. Per-file buttons have short action labels;
the filename appears once above the action. Upload mode choices appear first in
one equal-width row, with a shorter One PDF label and selected-mode guidance.
Controls retain their selected accessibility state and 44-point minimum height.
English and Urdu keys cover the new guidance. Full mobile/web suites, both
TypeScript checks, web build and whitespace checks pass for this follow-up.

### Mode guidance and compact file actions

Passport upload guidance now describes only the selected mode while retaining the first-two-pages requirement. The file type and size hint derives from backend rules and shows only PDF for combined mode. Per-file View/Download buttons sit beside wrapping filenames, keep their action colors and a 44-point touch target, and reverse the row for Urdu. Regression coverage checks mode guidance and accepted-file hints.

Validation: mobile/web typechecks; mobile 131 suites (1,273 passed, 24 skipped); web 202 files (2,023 passed); web production build; focused documents suite 59 passed after adding the screenshot instruction fixture; git diff check. Native-device visual verification remains outstanding.

Per user follow-up, the compact per-file View/Download buttons now use a 34-point height. The main document actions retain their existing sizing.

Documents screen buttons now inherit a screen-scoped 34-point height, including upload pickers, submit/cancel, retry, bank details, removal icons, and confirmation dialog actions. Mode selectors also use 34 points. Per-file View/Download actions override this to 30 points. Other screens retain their existing button sizing.

Sizing validation: mobile typecheck, full Jest suite (131 suites passed, 1,273 tests passed, 24 skipped), and git diff check passed. Native visual QA remains pending.

CNIC and next-of-kin CNIC upload copy now describes front/back sides only, with separate readable scan/photo guidance or one PDF containing both sides. Removed the repeated Upload/Replace heading and backend both-mode paragraph for these cards. Slots read Front side/Back side; incomplete-side validation also uses CNIC-specific copy. English and Urdu included.

Passport uses the same concise structure without a repeated Upload/Replace heading. Its mode copy asks for separate readable scans/photos of the first two pages, or one PDF containing both pages, while retaining Page 1/Page 2 slots.

Copy validation: mobile/web typechecks; mobile full suite 131 suites passed (1,273 passed, 24 skipped); web full suite 202 files/2,023 tests passed; web production build and git diff check passed.
