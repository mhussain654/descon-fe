# Admin candidate workspace and onboarding fees

The candidate detail page opens on Overview: document/payment summaries, current workflow progress, and the next available backend-authorized actions. Profile editing, document review links, fee controls, specialist records, and full activity history have their own keyboard-accessible sections. Records groups QVC, visa, flight, and protection information into expandable sections; calls remain accessible there. Activity sorts workflow history newest first.

## Set the default fee

Open Finance payments. The Default onboarding fee card is above the transaction list. Select Set default fee, enter an amount such as 26800 and a reason, then Save. The default applies to candidates without an override. Existing active bills and paid transactions retain their original amounts.

## Change one candidate's fee

Open Candidates, select the candidate, and choose Payments. Select Change fee, clear Use default fee, enter the amount and reason, then Save. Select Use default fee and save with a reason to remove an override. Fees can be prepared before the fee stage; candidate checkout still becomes available only through the existing Fee Pending eligibility rules.

Overrides belong to the current assignment. A later assignment starts with the default. Candidate-specific editing is unavailable during an active checkout, after a successful payment, or without an assignment. Expired unpaid attempts do not lock a fee. Read access requires view_payments or manage_payments; writes require manage_payments, and candidate fee access also requires candidate-view permission. Backend authorization is authoritative.

## Backend dependency and validation

Deploy the companion backend migration/API before this frontend. The existing configured fee initializes the database default; changing ONBOARDING_FEE_AMOUNT later does not overwrite an admin-managed fee. Set the desired default through the new form after deployment.

Frontend full verification: 204 web files / 2044 tests passed; 132 mobile suites / 1294 tests passed, 24 skipped. Final workflow/page checks passed after adding collapsible records. Web build, mobile typecheck, diff checks and the explicit admin-workspace typecheck passed. The main web typecheck now includes that explicit check because the legacy include glob did not cover these files.

Ruby/Bundler are unavailable in this workspace, so backend RSpec, migration execution, RuboCop, Zeitwerk and security checks remain unverified. Live admin sign-in previously reported it could not reach the server; live visual/responsive QA remains to be completed on the deployed app. Automated tests cover bilingual fee content, keyboard navigation, overrides/default restoration, exact decimal validation, locking, errors, and API contracts. No live fee or candidate record was changed.
