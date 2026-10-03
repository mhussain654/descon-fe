# Mobile Status redesign

The candidate Status tab follows the consent and Documents visual direction: compact blue gradient hero, official brand header, pale blue page surface, rounded progress summary, and colored timeline cards. Completed stages use green, the backend current stage uses blue, and upcoming stages use muted blue-grey, with text badges as well as color.

The progress summary uses backend completed/total counts and progress percentage. Stage names, order, status, dates, QVC outcomes, visa decisions, and download eligibility retain their existing API sources. No workflow stages are invented or reordered. An unassigned empty timeline has an explicit localized empty state.

Visa-copy and flight-ticket actions remain beside their relevant stage details. Compact green Download buttons use the existing signed-URL access hooks, busy disabling, API-origin checks, and inline access errors. No signed links are preloaded or persisted. Downloads are offered only under the existing attachment/stage conditions. Pull-to-refresh and return-to-tab refetch progress, history, flight details, and visa decisions together.

English and Urdu are supported. Timeline rows, history rows, progress-bar origin, badges and downloads use physical layout direction. Stage names and history wrap; copy uses Nastaliq spacing where needed. Status screen action buttons use a screen-scoped 34-point height, consistent with the recent compact Documents sizing.

Validation covers reported progress percentage, an empty assignment, backend stage order/current status/dates, Urdu labels, QVC/visa outcomes, attachment visibility, signed download URLs, rejected/unattached files, API-origin rejection, session/offline/retry behavior, and all four refresh queries. Native small/large-phone and font-scaling visual QA remains outstanding: no native emulator or device is available in this workspace.

Checks passed: mobile/web typechecks; mobile Jest 131 suites (1,275 passed, 24 skipped); web Vitest 202 files (2,023 passed); web production build; git diff check. The existing 26 Status integration tests and two new progress/empty-state cases pass as part of the full mobile run.

Follow-up: stage badges now sit at the physical right of the stage-name heading, with dates below. Long names wrap within the remaining width. Pending replaces Upcoming using the existing localized Pending label.
Alignment validation: mobile typecheck, all 28 Status integration tests, and git diff check passed. Phone visual verification remains pending.
