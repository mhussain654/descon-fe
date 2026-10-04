# Mobile candidate consent redesign

Branch: `feat/mobile-consent-redesign`, based on `feat/dynamic-documents`.

The post-login consent gate now follows the selected mobile design: blue gradient
hero, official Descon branding, shield and travel/document icons, rounded statement
sections, explicit agreement checkbox, primary acceptance action and logout.
English contains the complete supplied Candidate Consent wording; Urdu uses the
same translation keys with Nastaliq and physical RTL alignment. Web UI is unchanged.

Acceptance continues through the existing `POST /api/v1/candidate/consent` client
and session update. The current-policy gate and redirect to the dashboard remain
in place. The checkbox is initially unchecked. Pending requests disable repeated
acceptance, checkbox changes, language changes and logout. Failures retain the
selection and allow retry; acceptance is never recorded locally ahead of the API.

The screen uses safe-area insets and a ScrollView. Text is not line-clamped, the
header wraps at larger font sizes, and the primary action grows with its label.
Existing fonts, native SVG and icons are reused; no dependency was added.

Verification: mobile TypeScript and the full Jest suite, web TypeScript/tests/build
(shared translation regression checks), and `git diff --check`. Consent tests cover
unchecked acceptance, complete statement, successful persistence/navigation,
failure, language switching, pending protection and logout. Native-device visual
QA remains necessary for final English/Urdu font scaling on iOS and Android;
this workspace does not have a native emulator.
