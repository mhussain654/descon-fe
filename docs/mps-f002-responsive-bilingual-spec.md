# MPS-F002 — Responsive & Bilingual Design Specification

This document records the standards the codebase already follows
consistently — derived from evidence in the current implementation, not
aspirational — plus the deviations and inconsistencies found while
compiling it (see §11). Where a pattern is inconsistent across screens,
this document names the **majority/correct** pattern as the standard and
flags every deviation explicitly, rather than picking a new convention.

---

## 1. Mobile, tablet, and desktop layouts

**Web** (`web/tailwind.config.js`) uses Tailwind's **default breakpoint
scale**, unmodified: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px,
`2xl` 1536px. Evidence of the standard in practice:
- Candidate screens are intentionally narrow single-column (`max-w-xl`/
  `max-w-4xl`/`max-w-5xl` centered containers on Welcome/Login/Dashboard/
  Documents/Status/Profile) — there is no separate tablet/desktop layout
  for candidate screens because the content itself never needs one; this
  is a deliberate, not missing, choice.
- Staff/admin screens use real responsive grids: `grid grid-cols-1
  lg:grid-cols-3` (candidate detail), `grid grid-cols-1 gap-4 sm:grid-cols-2
  lg:grid-cols-3` (document-review queue cards), `flex-col gap-4 sm:flex-row`
  (admin dashboard filters), `overflow-x-auto` wrapping any table.
- **Standard**: any new staff/admin layout with more than one logical
  column at desktop width must collapse to a single column below `lg:`
  (or `sm:` for two-column card grids), and any table must be wrapped in
  `overflow-x-auto` rather than a bespoke horizontal-scroll implementation.

**Mobile** has no breakpoint system — React Native has no CSS media
queries. The standard here is:
- Use `useSafeAreaInsets()` for every screen-level padding (top/bottom),
  never a hardcoded status-bar/notch offset — every screen inventoried
  uses this consistently.
- Use `ScrollView` (not a fixed `View`) for any screen whose content can
  exceed the viewport under large font scaling or landscape — `welcome.jsx`
  documents this exact reasoning in a code comment ("Small phones,
  landscape orientation and larger font scales can push this content
  taller than the viewport").
- `supportsTablet: true` is set in `mobile/app.json` for iOS, but no
  screen has an iPad-specific layout — content simply reflows via
  `flexWrap`/`flex: 1`. This is acceptable for the current screen set
  (none has dense enough content to need a two-pane tablet layout) but
  should be revisited if a future screen (e.g. a staff-facing mobile
  screen, if ever built) needs one.

---

## 2. English/Urdu switching and RTL direction

- **Single source of truth**: `shared/i18n/translations.ts` (the
  translation catalog) and `shared/i18n/locale.ts` (`isRTL(language) =>
  language === 'ur'`, `formatNumber`/`formatCurrency` via `Intl`).
- **Persistence key**: both platforms use the identical string key
  `descon.language` (`localStorage` on web, `AsyncStorage` on mobile) —
  this must never change without a migration, since candidate-workflow
  session-injection tooling and tests key off this exact string.
- **Web** applies direction synchronously: `document.documentElement.dir
  = isRTL(language) ? 'rtl' : 'ltr'`, plus a Nastaliq font class toggle
  for Urdu. Effect runs on every language change, and on initial mount
  from the persisted value.
- **Mobile** applies direction via `I18nManager.allowRTL`/`forceRTL`,
  which **only takes effect after a JS bundle reload** — `reloadApp()`
  handles this automatically on every *in-session* language switch
  (`DevSettings.reload()` in dev, `Updates.reloadAsync()` in production),
  gated so it never reloads if the RTL direction didn't actually change.
  **Standard**: any future language addition must preserve this reload
  gate — a naive `I18nManager.forceRTL(x)` call without a reload is a
  silent no-op on native and has caused a regression before (there is a
  dedicated regression test for exactly this: "reloads the app after
  switching language changes the RTL direction").
- **Where language can be changed**: only from the Welcome screen (before
  login) and the candidate Profile screen (after login), on both
  platforms. **No staff/admin screen exposes a language toggle** — this is
  consistent with AGENTS.md's allowance that "administrative workflows
  remain web-focused," but `LanguageContext` is still mounted globally
  (`web/src/app/layout.jsx`), so an admin screen would render correctly in
  Urdu/RTL if the persisted value happened to be `ur` on that browser
  profile. This asymmetry (global provider, candidate-only affordance) is
  intentional, not a bug, and should stay that way unless product
  explicitly asks for staff-side localization.
- **CSS logical properties are the mandatory standard, not `ml-`/`mr-`/
  `pl-`/`pr-`/`marginLeft`/`marginRight`**, because Tailwind's `flex-row`
  and React Native's `flexDirection: 'row'` both auto-mirror under
  RTL/`I18nManager.isRTL`, but a *literal* left/right value does not — it
  stays pinned to the physical side, producing a gap on the wrong edge
  under Urdu. **This was violated in five places found during this audit
  (all fixed in this PR)**: three on mobile (`dashboard/index.jsx` ×2,
  `status/index.jsx` ×1, `profile/index.jsx` ×2 — all literal
  `marginLeft`/`marginRight`, corrected to `marginStart`/`marginEnd`), and
  three on web (`profile/page.jsx` — `mr-3` ×2 → `me-3`, `ml-2` → `ms-2`,
  plus `text-left` → `text-start` and a hardcoded `ChevronRight` that now
  flips to `ChevronLeft` under Urdu, matching the Documents screen's
  already-correct pattern). A repo-wide grep after the fix confirms zero
  remaining `marginLeft`/`marginRight`/`paddingLeft`/`paddingRight`
  literals anywhere in `mobile/src`.
- **The CNIC input field is a deliberate, tested exception**: it stays
  forced left-to-right even under Urdu/RTL (digits must not mirror), with
  a dedicated regression test on both platforms confirming this.

---

## 3. Typography and long translated labels

- Web font stack: `Inter` (Latin) + a Noto Nastaliq Urdu class toggled on
  for Urdu (`font-noto-nastaliq-urdu`, applied to `<html>`), loaded via
  Google Fonts (the one external font host artifacts are allowed to use).
- Mobile: `Inter_400Regular`/`500Medium`/`600SemiBold` via
  `@expo-google-fonts/inter`; no distinct Urdu display font is loaded on
  mobile today (worth checking whether Urdu renders acceptably with the
  system fallback on the exact devices product cares about — not verified
  as broken, just not confirmed with a dedicated font either way).
- **Long Urdu label handling**: verified via test evidence, not
  assumption — `mobile/src/app/login.test.jsx` has a dedicated test
  "renders in Urdu when that is the persisted language, with a long-text
  error that is not clipped." The standard this implies: any text
  container holding a translated string must allow wrapping (`flexShrink:
  1` / `flex-1` on the containing view, never a fixed single-line height),
  which every screen inventoried already does for body/label text.
- **Standard for new translation keys**: add both `en` and `ur` values in
  the same commit (`shared/i18n/translations.test.ts` enforces key-parity
  between the two language blocks — a missing translation fails the test
  suite, not just a silent runtime fallback).

---

## 4. Navigation behavior

- **Web**: fully file-based routing (`web/src/app/routes.ts` walks the
  `app/` directory tree at build time; every `page.jsx` becomes a route
  automatically, `[id]` becomes a dynamic segment). There is no manual
  route table to keep in sync — deleting a `page.jsx` directory removes
  its route automatically (this is how MPS-F302 cleanly removed
  `/payment`).
- **Mobile**: Expo Router, same file-based convention
  (`app/(tabs)/dashboard/index.jsx` etc.), with a `Stack` at the root
  (`welcome` → `login` → `(tabs)`) and a `Tabs` navigator for the four
  candidate destinations (Dashboard/Documents/Status/Profile).
- **Auth-gated navigation**: both platforms use a single, centrally-placed
  guard rather than repeating an auth check per screen — mobile's
  `RequireAuth` wraps the entire `(tabs)` group once in its `_layout.jsx`;
  web's `RequireStaffAuth` wraps every `/admin/*` screen via a shared
  `StaffShell` component. **Standard**: never add a per-screen auth check
  — wrap the screen in the existing guard at the layout/shell level.
- **Confirmed navigation gap (not fixed in this PR — needs a product
  decision, not a "tiny" fix)**: on mobile, app launch always redirects to
  `/welcome` regardless of whether a valid session is already persisted
  (`mobile/src/app/index.jsx` is an unconditional `<Redirect
  href="/welcome" />`), and neither `welcome.jsx` nor `login.jsx` checks
  `status === 'authenticated'` to skip ahead. A returning candidate with a
  fully valid session must manually tap through Welcome → Login on every
  cold launch. See the MPS-F001 inventory (§1.4) for the full write-up and
  recommended follow-up ticket.
- **Confirmed dead route**: `web/src/app/admin/page.jsx` links to
  `/admin/candidates/new`, which has no corresponding page anywhere in the
  repo and silently falls through to the catch-all not-found route. Not
  fixed here (building the missing screen, or deciding to remove the
  entry point, is a product decision) — recorded under MPS-F304 in the
  inventory.

---

## 5. Forms and validation messages

- **Standard pattern, consistent across every form found**: client-side
  validation is a UX improvement only and never treated as authoritative
  — every validation module's own comment says so explicitly (e.g.
  `shared/candidateDocuments/fileValidation.ts`: "This is a UX improvement
  only -- the backend remains authoritative"). Server-side rejections are
  always re-surfaced as their own distinct error, never silently
  swallowed in favor of the client's own guess.
- Field-level errors are associated with their field (`aria-describedby`/
  `aria-invalid` on web inputs; `errorMessage` prop on the shared
  `TextField`/`Input` components on both platforms) — not a single
  page-level error blob disconnected from the field that caused it.
- A single generic error is used deliberately wherever revealing which
  specific field failed would leak information — staff login shows the
  identical message for "unknown email" and "wrong password"; this is a
  security-conscious pattern, not an oversight, and must be preserved by
  any future auth-adjacent form.
- Idempotency keys guard every non-idempotent mutation this codebase
  performs more than once in a session (document upload, document
  submission, workflow transition on the backend side) — the standard,
  proven in `shared/candidateDocuments/idempotency.ts`, is: reuse the same
  key when retrying an identical payload, mint a new key the instant
  *anything* about the payload changes (a different file, a different PCC
  issue date), and always mint a fresh key after a `CONFLICT`/
  `REPLACEMENT_NOT_ALLOWED` response rather than replaying a doomed
  request.

---

## 6. Loading, empty, error, offline, and retry states

Every screen inventoried in MPS-F001 that talks to a real backend follows
the same `renderBody()`-style dispatch, in this priority order:

```
Loading → SessionExpired → Forbidden(inactive-account) → Offline → Error(+retry) → Empty → content
```

- **Loading**: a single shared `LoadingState` component on both platforms
  — never a bespoke spinner per screen.
- **SessionExpired / inactive-account**: a dedicated confirmation screen
  with its own explicit action button that ends the session — **never** a
  silent auto-redirect. (Dashboard's original silent
  `useEffect`-triggered logout was identified and replaced with this exact
  pattern during MPS-F302; this is now the enforced standard everywhere.)
- **Offline**: a distinct `OfflineState` with its own retry action,
  derived from a real connectivity signal (`navigator.onLine` on web,
  `NetInfo` on mobile) rather than conflated with a generic server error.
  **One exception found**: the candidate login/OTP screen renders its
  `OFFLINE` error code through the same generic inline message as any
  other `otpError`, not a dedicated banner — lower severity (still
  accurate and localized) but inconsistent with every other screen's
  pattern; worth a small follow-up.
- **Error with retry**: every error state that isn't session-ending
  offers an explicit retry action wired to the same query's own refetch —
  never a dead-end message.
- **Empty**: the shared `EmptyState` component. **This was missing
  entirely on the Documents screen until MPS-F401** — an empty checklist
  (zero required documents) rendered nothing at all, despite the
  `candidateDocumentsEmptyTitle`/`Description` translation keys existing
  unused since before that ticket. Confirm this pattern before shipping
  any new list/collection screen: an empty *successful* response must
  never look identical to "still loading" or "the request failed."
- **Preserving cached data on a failed background refresh**: the
  document-review queue is the one screen that explicitly does this
  correctly — a background refetch failure shows a small `RetryBanner`
  over the still-visible, still-usable stale data, rather than replacing
  it with an error screen. **Standard**: this is the correct behavior for
  any screen with `refetchOnWindowFocus`/polling and should be the model
  for any future screen with the same requirement, not the "blank on any
  error" behavior seen on the two mock-backed admin screens (§11).

---

## 7. Keyboard navigation and visible focus

- Web's design-system primitives (`Button`, `Input`, `Dialog`) carry
  `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
  consistently — verified directly in the Welcome screen's
  `LanguageOptionCard` and reused throughout.
- The Documents upload panel's file input is a real, visually-hidden
  native `<input type="file">` (`className="sr-only"`) triggered by a
  visible, keyboard-reachable button — not a `<div onClick>` masquerading
  as a control, which would be unreachable by keyboard entirely. This is
  the correct pattern and should be the template for any future
  "styled trigger + hidden native control" need.
- Radix-based components (`Dialog`, used by the confirm/role-change flows
  in staff user management) inherit correct focus-trap and
  `aria-hidden` background behavior for free — confirmed via a test
  comment referencing this exact Radix behavior.

---

## 8. Accessible labels, contrast, touch targets, and font scaling

- Icons that convey meaning pair with visible text rather than standing
  alone — e.g. `ValidationMessage` (mobile design system) explicitly
  "pairs an icon with the text so meaning doesn't rely on color alone"
  (its own code comment).
- `accessibilityRole`/`accessibilityLabel`/`accessibilityState` are used
  consistently on mobile interactive elements (confirmed on the language
  cards, the disabled payment tile, the logout button).
- Font scaling: `welcome.jsx`'s `ScrollView`-over-fixed-`View` choice is
  explicitly justified by "larger font scales" in its own comment — this
  is the one place scaling was explicitly designed for; other screens
  should be spot-checked against a large system font-scale setting before
  being considered accessibility-complete, since this was not exhaustively
  verified across every screen in this audit.
- **Standard for icon-only interactive elements**: none were found in this
  audit that lack a label (every icon button/tile has adjacent text or an
  explicit `accessibilityLabel`) — keep it that way; a future icon-only
  control (e.g. a bare chevron button) must carry one.
- Color tokens (`shared/design-tokens.ts`, mirrored into
  `web/tailwind.config.js`) define semantic `success`/`warning`/`danger`/
  `info` pairs with both a `DEFAULT` and an `on` (foreground-on-that-color)
  value — this is the mechanism that keeps contrast correct across every
  status chip/tile without each screen picking its own color pair.

---

## 9. Status presentation without relying on color alone

The established, correct pattern — confirmed across Documents, Status,
and the admin document-review screens — is: **every status maps to both a
distinct icon and a distinct color**, never color alone:

| Status | Icon | (never color-only) |
|---|---|---|
| `verified` | `CheckCircle` | |
| `pending_review` | `Clock` | |
| `uploaded` | `Upload` | |
| `rejected` | `XCircle` | |
| `missing`/pending | `Upload` (neutral tone) | |
| PCC `expired`/`near_expiry` | appended text label, distinct tone | |

This `STATUS_CONFIG`-shaped mapping is duplicated near-verbatim between
`web/src/app/documents/page.jsx` and
`mobile/src/app/(tabs)/documents/index.jsx` (see §11 — a real duplication,
not yet extracted to `shared/`). **Standard**: any new status value added
to the backend contract must get its own icon, not just a new color,
before it ships on either platform.

---

## 10. Consistent representation of the 15 recruitment stages

The canonical stage list (`WorkflowStage::CANONICAL_STAGES` in
`descon-be`) is the single source of truth:

```
1. registered                          9.  qvc_appointment_booked
2. documents_pending                   10. qvc_completed_outcome_received
3. documents_uploaded                  11. visa_issued_or_rejected
4. under_verification                  12. appeared_for_protection
5. verified                            13. protected_ready_to_fly
6. fee_pending                         14. flight_details_uploaded
7. fee_paid                            15. mobilized
8. documents_shared_with_qatar_bu
```

- **Standard**: the frontend never re-derives, reorders, or infers this
  list — it is always read directly from the backend's `workflow.timeline`
  response (`shared/applicationProgress/currentDashboardStage.ts`,
  `web/src/app/status/page.jsx`, mobile equivalent), and the same
  `WorkflowStage`/`WorkflowHistoryItem` shape backs both the candidate's
  own Status page and Dashboard's "current stage" summary — this is
  exactly why those two screens were previously inconsistent (before
  MPS-501) and are now guaranteed to agree, since they share one
  computation (`currentDashboardStage(workflow.timeline)`) over one
  response.
- Never infer a downstream stage from documents alone — the Prerequisite
  Validator on the backend is the only authority on whether a stage
  transition is unblocked; the frontend only displays what the backend's
  `timeline`/`workflow_state` response already says.
- QVC-specific evidence (`qvc_outcome_code`/`qvc_outcome_date`) is
  rendered only from `workflow_history`'s `details` object, never
  fabricated or inferred from the stage name alone (e.g. reaching
  `qvc_completed_outcome_received` does not by itself imply "approved" —
  the actual `qvc_outcome_code` must be present).
- **No admin screen surfaces stage transitions at all** (see MPS-F001
  §8.3) — so today, the "consistent representation of the 15 stages"
  standard is fully realized only on the candidate side. Any future admin
  workflow-management screen must reuse the exact same canonical stage
  list/order and the same status-plus-icon convention from §9, not invent
  a parallel one.

---

## 11. Findings: hardcoded content, dead routes, prototype remnants, inconsistent labels, duplicated patterns

- **Prototype remnants (largest finding)**: `web/src/app/admin/page.jsx`
  and `web/src/app/admin/candidates/[id]/page.jsx` both still call a
  fake, in-memory mock API (`web/src/app/api/*` + `mock-db.js`) with
  hardcoded example data (payments `PAY-2026-001`/`PAY-2026-002`,
  candidate records) — not the real backend. Full detail and recommended
  follow-up ticket in the MPS-F001 inventory, §8.1/8.2.
- **Dead route**: `/admin/candidates/new`, linked from `admin/page.jsx`,
  does not exist. See MPS-F001 §8.1.
- **Removed dead route, confirmed gone**: `/payment` (deleted in
  MPS-F302) — README.md still described it as an "approved, preserved"
  route; **corrected in this PR**.
- **Stale documentation**: README.md's "Both apps currently run on
  mock/in-memory data... not wired into any screen yet" was true when
  originally written but is now false for every screen except the two
  named above — **corrected in this PR** to name exactly which two
  screens are still mock-backed, rather than implying the whole app is.
- **Stale code comment**: `web/src/contexts/AuthContext.tsx` described
  MPS-201 as "not-yet-built" — it has been built and wired since; the
  comment now accurately describes the real remaining gap (no httpOnly
  `Set-Cookie` from the backend yet) — **corrected in this PR**, no
  behavior change.
- **Duplicated UI pattern, not yet shared**: the document-status
  `STATUS_CONFIG` icon/color/label map (§9) is defined separately, nearly
  identically, in both `web/src/app/documents/page.jsx` and
  `mobile/src/app/(tabs)/documents/index.jsx`. Extracting the
  status→icon-name mapping into `shared/candidateDocuments/statusLabels.ts`
  (which already owns the *translation-key* half of this mapping) would
  remove the duplication — not done in this PR since it touches
  already-shipped, heavily-tested screens outside a "tiny, clearly safe"
  fix, and risks exactly the kind of behavior change this ticket's scope
  restrictions warn against. Recommend as a small, low-risk refactor
  ticket of its own.
- **Duplicated verify/reject implementation**: `admin/candidates/[id]
  /page.jsx`'s document verify/reject flow (mock-backed, unauthenticated)
  functionally duplicates the real, correct, already-shipped
  `admin/document-reviews/[id]/page.jsx` flow. See MPS-F001 §8.2 — the
  recommended fix is to delete the duplicate and point the candidate-
  detail page at the existing real client, not to build a third
  implementation.
- **Inconsistent offline-state treatment**: candidate login/OTP renders
  `OFFLINE` through the same generic inline error path as every other
  error code, while every other screen with a real backend call (§6) uses
  a dedicated `OfflineState` component. Minor, not fixed here (touches the
  auth flow's error-rendering branch, out of "tiny" scope), recorded for
  a future small fix.
- **RTL literal-margin inconsistency**: five occurrences on mobile, three
  on web — all found and fixed in this PR (§2). A repo-wide grep
  confirms zero remaining occurrences in `mobile/src`; the three
  remaining `mr-`/`ml-`-style occurrences found on **admin-only** screens
  (`admin/page.jsx`'s search-icon padding, `admin/candidates/[id]
  /page.jsx`'s back-icon and timeline-icon spacing) were **left as-is** —
  staff/admin screens are not required to support Urdu/RTL per AGENTS.md,
  and `admin/candidates/[id]/page.jsx` is already flagged for a larger
  rebuild (it's one of the two mock-backed prototype screens above), so
  patching cosmetic RTL details on code slated for replacement was judged
  not worth the changed-lines cost here — recorded for whoever rebuilds
  that screen to get right the first time.

---

## Verification

- `git diff --check` — clean (see PR).
- Web: typecheck clean, full test suite passing, production build clean.
- Mobile: typecheck clean, full test suite passing.
- Every fix described above (RTL literals ×8, two stale-comment
  corrections) was verified against the existing test suite for the file
  it touched — no new test was needed for the comment/README corrections
  (no behavior change), and the RTL literal-to-logical-property renames
  are pure visual corrections already covered by each screen's existing
  render tests (confirmed passing, not skipped).
