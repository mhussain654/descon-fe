# Mobile Profile redesign

The mobile Profile tab now follows the consent, Documents and Status direction: compact blue gradient brand header, pale blue page surface, rounded cards and colorful icons.

The smaller photo and name card is followed by Personal Information (masked CNIC and one reference-number row), Assignment & progress (destination country, candidate status, current workflow stage, backend document submission state), and Preferences & account (language and logout). The reference number is no longer duplicated in the identity card. All previously approved profile values remain available; no new personal fields are introduced.

The route keeps its existing profile/progress queries, authentication errors, focus refetch and pull-to-refresh. Only backend-masked CNIC is rendered. Photo URLs are resolved through the existing API-origin validator. Photo capture/gallery/removal, permission handling, validation, upload state and errors retain the existing photo hook. Logout remains accessible during loading or profile errors. Language switching remains available and uses the existing context.

Presentation lives in TypeScript components. English/Urdu copy, physical row direction, text alignment, wrapping names/reference numbers, and Nastaliq line spacing are included. Profile actions use the screen-scoped compact 34-point sizing; the avatar is 72 points and photo choices can use the card width.

Validation covers approved safe fields, a single reference number, grouped sections, backend document-verification states, unassigned candidates, photo editing/permissions, session/offline states, language switching and logout. Native small/large-phone visual verification and font scaling remain pending because no emulator or device is available in this workspace.

Checks passed: mobile/web typechecks; mobile Jest 131 suites (1,275 passed, 24 skipped); web Vitest 202 files (2,023 passed); web production build; git diff check.

Logged-in Documents, Status, and Profile headers omit the repeated Descon logo and keep their compact page title and icon. Dashboard already has no logo. Login and consent retain branding.
