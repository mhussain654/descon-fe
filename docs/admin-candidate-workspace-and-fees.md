# Admin candidate workspace and onboarding fees

The candidate detail page opens on Overview: document/payment summaries, current workflow progress, and the next available backend-authorized actions. Profile editing, document review links, fee controls, specialist records, and full activity history have their own keyboard-accessible sections. Records groups QVC, visa, flight, and protection information into expandable sections; calls remain accessible there. Activity sorts workflow history newest first.

## Set the default fee

Open Finance payments. The Default onboarding fee card is above the transaction list. Select Set default fee, enter an amount such as 26800 and a reason, then Save. The default applies to candidates without an override. Existing active bills and paid transactions retain their original amounts.

## Change one candidate's fee

Open Candidates, select the candidate, and choose Payments. Select Change fee and enter the amount and reason, then Save. The amount field is always visible; typing switches to a custom fee automatically. Select Use default fee and save with a reason to remove an override. Fees can be prepared before the fee stage; candidate checkout still becomes available only through the existing Fee Pending eligibility rules.

Overrides belong to the current assignment. A later assignment starts with the default. Candidate-specific editing is unavailable during an active checkout, after a successful payment, or without an assignment. Expired unpaid attempts do not lock a fee. Read access requires view_payments or manage_payments; writes require manage_payments, and candidate fee access also requires candidate-view permission. Backend authorization is authoritative.

## Backend dependency and validation

Deploy the companion backend migration/API before this frontend. The existing configured fee initializes the database default; changing ONBOARDING_FEE_AMOUNT later does not overwrite an admin-managed fee. Set the desired default through the new form after deployment.

Frontend full verification: 204 web files / 2044 tests passed; 132 mobile suites / 1294 tests passed, 24 skipped. Final workflow/page checks passed after adding collapsible records. Web build, mobile typecheck, diff checks and the explicit admin-workspace typecheck passed. The main web typecheck now includes that explicit check because the legacy include glob did not cover these files.

Ruby/Bundler are unavailable in this workspace, so backend RSpec, migration execution, RuboCop, Zeitwerk and security checks remain unverified. Live admin sign-in previously reported it could not reach the server; live visual/responsive QA remains to be completed on the deployed app. Automated tests cover bilingual fee content, keyboard navigation, overrides/default restoration, exact decimal validation, locking, errors, and API contracts. No live fee or candidate record was changed.

## Fee usability follow-up

Overview displays the backend effective fee amount beside the workflow payment status, including the original bill amount after payment. The fee editor and Overview share a query cache, so a saved change updates both. Staff without fee-read permissions retain the status without an amount.

Admin typography is increased by 2px, including navigation, sign-in, dialog content and chart labels. This is scoped to admin surfaces; candidate typography and global rem spacing remain unchanged.

Follow-up validation: all 204 web test files / 2044 tests passed, web typechecking (including the explicit admin workspace check), production build and diff checks passed. Live layout verification remains to be completed in the running admin app.

## Candidate directory redesign

The candidate index places search, status and sorting immediately under a compact header. The oversized chart and duplicate count grid are replaced with up to six stage shortcuts, ordered by count with the selected stage kept visible. All other stages, including zero counts, remain available in an expandable breakdown. Clicking a shortcut toggles the status filter and resets pagination; URL filters still survive refresh and navigation. Counts come from the backend and retain its summary scope.

Country-specific stages from docs-per-country are now localized in English/Urdu and supported by the status selector and URL parser. Existing candidate links, creation permissions, controlled table scrolling, errors, retry and pagination are retained. This follow-up is based on frontend feat/mobile-consent-redesign at 73727fb; no backend mutation or deployment is required.

Directory follow-up verification: 204 web files / 2046 tests passed, including country-stage URL persistence, shortcut filtering and Urdu labels. Web typecheck, production build and diff checks passed. Live responsive layout verification remains to be completed in the running admin app.

## Graphical candidate view

List view remains the default. A keyboard-accessible Graphical view tab displays the backend stage summary in a bounded, scrollable bar chart, with stage counts also available as ordinary accessible buttons. Selecting a stage opens List view with that status and resets pagination; search and other URL filters remain intact. The graph uses the backend summary across all pages: assignment filters apply, while search and status apply to the list. Zero-count stages remain in the expandable breakdown; empty summaries and loading/error/retry states are explicit. English and Urdu labels are supported.

Admin text is reduced by 2px from the previous larger scale, including responsive utility sizes, sidebar labels, sign-in, portal dialogs and chart annotations. The candidate-facing font scale is unchanged.

Graphical view follow-up validation: all 204 web files / 2048 tests passed, including keyboard tab switching, stage-to-list navigation, retained search, empty graph and Urdu labels. Web typecheck, production build and diff checks passed. Live responsive visual review remains to be completed on the running app.
