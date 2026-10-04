# September meeting requirements and implementation

## Approved scope

Use MPS Connect as the application name. Keep Descon Engineering Limited in legal consent text and company ownership references. Show the MPS Connect product label below the logo on mobile welcome/login/consent. Keep logged-in mobile pages without a repeated company logo. Desktop logo sizing/layout and payment finalization are deferred.

The candidate check means existence in the system, with the existing inactive-account restriction preserved. Do not add an assignment or mobilization-stage gate. Unknown CNICs show the approved non-registration message plus a dismissible English/Urdu guidance dialog directing users to check the CNIC and contact the MPS team if correct. Dismissal permits correction without sending another OTP. OTP timers still use backend values; backend defaults change to 600 seconds with the existing resend cooldown and retry limits.

## Changes

- Product names in mobile app display name, mobile branded screens, web document title, staff portal name, and shared app messages use MPS Connect.
- Dashboard reference label is HOF # followed by the existing reference_number. No Head Office field, numbering policy, or new identifier is introduced.
- Mobile Status shows the BU from the backend mobilization-process country for configured countries, with localized names. No stage or assignment is inferred.
- Proper Urdu script and Nastaliq on mobile remain in place. New copy includes both languages.
- Existing progress bar, highlighted status, dashboard card placement, Profile destination, document status/actions, and dynamic checklist/workflow contracts are retained.

## Validation and review

Frontend: full mobile and web tests, both typechecks, web build, git diff check. Native small/large-device checks, Urdu font scaling, and a language/content review by MPS remain required.

Backend: OTP expiry, bilingual error/SMS text, OpenAPI examples and expiry tests are included in the separate backend patch. Ruby/Bundler is unavailable in this workspace, so backend checks must run in the developer environment/CI before release. Existing deployed OTP_EXPIRY_SECONDS overrides must change to 600.

## Outstanding MPS inputs

Common, KSA and Qatar document definitions are implemented. UAE, Oman, Kuwait, Azerbaijan and South Africa retain provisional common checklists/processes. Their final BU-specific requirements and workflow must come from MPS; no additional rules are fabricated. The application review PDF consolidates the journey and bilingual candidate copy for MPS validation. MPS must approve English/Urdu wording, links, document requirements, and country-specific workflow.
