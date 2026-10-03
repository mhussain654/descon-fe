# Mobile documents redesign

Continues the consent design on `feat/mobile-consent-redesign`: compact blue
brand header, document illustration, rounded pale-blue content area, colorful
summary tiles and document icons, clear Upload/Replace labels, and matching bank
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
