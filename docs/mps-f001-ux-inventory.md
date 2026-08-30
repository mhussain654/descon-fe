# MPS-F001 — Frontend UX Inventory

Audited against the actual implementation on `main` after PR #13 (candidate
workflow timeline + query-key isolation), PR #15 (dashboard reliability) and
MPS-F401 (document capture completion). Every row below was verified by
reading the actual route/source files and the real API client each screen
calls, then cross-checking that client's request path against
`descon-be/openapi/openapi.yaml`. No screen is classified `implemented`
from a static component or prototype markup alone — where a screen renders
correctly but calls a mock/fake data source instead of the real backend,
it is classified `partial` (or `missing`, if there is no real backend
counterpart at all) and the gap is stated explicitly.

## Legend

- **implemented** — real backend contract, all required states handled, translated.
- **partial** — real backend contract but a meaningful gap (missing state, missing test, incomplete translation, or only some of the screen's features are real).
- **missing** — no working implementation of a required capability, on either the frontend or backend.
- **backend-blocked** — the frontend is ready (or trivial) but the backend does not yet expose the data/endpoint needed.

---

## 1. Language selection, CNIC login, OTP verification, and session handling

### 1.1 Language selection (pre-login)

- **Audience/role**: anyone (unauthenticated).
- **Route/source**: web `/` — `web/src/app/page.jsx`; mobile `welcome` — `mobile/src/app/welcome.jsx`.
- **API**: none — client-only preference.
- **Auth**: none required.
- **States**: static screen, no loading/error/empty states apply.
- **EN/UR/RTL**: full — `setLanguage("en"|"ur")` persists to `localStorage`/`AsyncStorage` under the shared key `descon.language`; web sets `document.documentElement.dir`/`lang` immediately; mobile applies `I18nManager.allowRTL`/`forceRTL` but **only takes effect after a JS bundle reload** (`mobile/src/contexts/LanguageContext.jsx`, `reloadApp()`), which is handled automatically when switching language mid-session but does **not** re-run on initial app-boot restore of a previously-persisted Urdu choice (see finding below).
- **Responsive/accessibility**: `LanguageOptionCard` uses `aria-pressed`/`accessibilityState={{selected}}`, visible focus ring on web (`focus-visible:ring-2`). Both platforms load the logo from an external CDN (`ucarecdn.com`) rather than a bundled asset — a network dependency at first paint, not a broken/dead reference, but worth noting as an unusual choice for a "load once, offline-safe" first screen.
- **Classification**: **implemented**.
- **Owning ticket**: MPS-F101 (frontend foundation, per repo naming) / MPS-F201 (candidate auth).

**Finding — mobile RTL boot restore**: on cold app launch, if the persisted language is already Urdu, `mobile/src/contexts/LanguageContext.jsx`'s restore path sets state but does not force a reload (comment: "not on initial app-boot restore"), relying on `I18nManager` having already been set from a *previous* session's reload. This is consistent behavior given Expo's `I18nManager` model, but is worth a dedicated regression test confirming a cold launch on a fresh install with Urdu already selected (e.g. restored from a device backup) renders RTL correctly. Not verified as broken — flagged for confirmation testing under whichever ticket next touches native language bootstrapping.

### 1.2 Language selection (post-login)

- **Route/source**: web `/profile` (`web/src/app/profile/page.jsx`, `toggleLanguage`); mobile `(tabs)/profile` (`mobile/src/app/(tabs)/profile/index.jsx`).
- **Classification**: **implemented**. No other candidate screen and **no staff/admin screen** exposes a language toggle (confirmed by grep — `toggleLanguage` is called only from the two candidate profile screens). `LanguageContext` is mounted globally (`web/src/app/layout.jsx`), so `/admin/*` routes *would* render correctly if `descon.language` happened to be `ur` (same-origin `localStorage` key shared with the candidate app on the same browser), but staff has no UI of their own to reach that state deliberately. This is consistent with AGENTS.md's "administrative workflows remain web-focused" allowance and is not treated as a gap for staff/admin, only noted for completeness.

### 1.3 CNIC login + OTP verification

- **Audience/role**: candidate, unauthenticated.
- **Route/source**: single route, two-step state machine (`step: 'cnic' | 'otp'`) — web `/login` (`web/src/app/login/page.jsx`); mobile `login` (`mobile/src/app/login.jsx`). Both call the shared `useCnicOtpFlow` hook (`shared/auth/useCnicOtpFlow.ts`) wrapping a pure reducer (`shared/auth/cnicOtpFlow.ts`).
- **API**: `shared/auth/realCandidateAuthClient.ts` → `POST /api/v1/candidate/auth/otp/request` (also used for resend — "no separate resend endpoint on the real backend") and `POST /api/v1/candidate/auth/otp/verify`. Both confirmed present in `openapi.yaml` (lines 1740, 1808).
- **Auth**: none required to reach it; successful verify returns the session used for every subsequent authenticated call.
- **States**: required-field / invalid-CNIC-format errors (client-side, before any request); `OTP_EXPIRED`, `OTP_MAX_ATTEMPTS`, `OTP_INVALID` (each clears the OTP field and shows a `RetryBanner` with resend); `RATE_LIMITED` (per-action: cnic/otp/resend, with a live countdown from the server's `retryAfterSeconds`); `RESEND_COOLDOWN` (client-computed from the challenge's own `resendAfterSeconds`, distinct from a server-side rate limit); offline/network failures render through the same generic error path (`AUTH_ERROR_KEYS[code]`), not a dedicated offline banner — a real but low-severity gap, since the message is still accurate and localized, just visually identical in weight to any other error. No forbidden/session-expired states apply (unauthenticated screen).
- **EN/UR/RTL**: full — spot-checked both platforms' login files line-by-line for hardcoded English text outside `t(...)`: **none found**. A dedicated test (`web/src/app/login/page.test.jsx`) confirms the CNIC input is forced LTR even under Urdu/RTL (correct — CNIC digits must not mirror).
- **Responsive/accessibility**: design-system `Input`/`Button`/`OtpField` components carry label association and visible loading/disabled states.
- **Classification**: **implemented**. Test coverage is thorough (23 reducer tests + ~10 page-level tests per platform), including rate-limiting, resend cooldown, and Urdu rendering.
- **Owning ticket**: MPS-F201 (frontend) / MPS-201 (backend, already built and wired — see finding below).

### 1.4 Session handling

- **Web** (`web/src/contexts/AuthContext.tsx`): session held **in React state only** — never `localStorage`/`sessionStorage`. A hard page reload always logs the candidate out; there is no session-restore-on-launch (no `'restoring'` status exists in the web `AuthStatus` type, unlike mobile). Expiry is checked every 5s while a session is held; `logout()` clears the session and calls `queryClient.clear()`.
- **Mobile** (`mobile/src/contexts/AuthContext.tsx`): session persisted via `expo-secure-store` (never AsyncStorage — correct, per AGENTS.md). On launch, `status` starts `'restoring'`, reads the stored session, validates its shape (zod) and expiry, and deletes it if malformed/expired. Same 5s expiry check and `queryClient.clear()` on logout.
- **Classification**: **partial**. Both platforms correctly implement what they claim to do, and are well-tested (12+ AuthContext tests on mobile, 6 on web) — but there is a real, user-facing asymmetry:
  - **Finding (web)**: web's session cannot survive a page reload at all. The code comment explaining why (calling MPS-201 "the not-yet-built... backend") was **stale** — MPS-201 is built and wired; the real reason is that the backend returns the access token in the JSON response body, not a `Set-Cookie` header, so there is nothing durable for the client to read back after a reload. **Fixed the stale comment in this PR** (`web/src/contexts/AuthContext.tsx`); the underlying behavior is unchanged and is real backend-blocked work (see below).
  - **Finding (mobile navigation)**: mobile's session *does* persist correctly, but the app's entry routing does not use that fact. `mobile/src/app/index.jsx` unconditionally redirects to `/welcome` on every launch, and neither `welcome.jsx` nor `login.jsx` checks `status === 'authenticated'` to skip ahead. `RequireAuth` (`mobile/src/features/auth/RequireAuth.tsx`) only guards *against* rendering `(tabs)` while unauthenticated — nothing redirects an *already*-authenticated candidate sitting on Welcome/Login *into* `(tabs)/dashboard`. Net effect: a candidate with a fully valid, persisted session must still manually tap through Welcome → Login → (re-enter CNIC/OTP) on every cold app launch. This is a real, verified navigation gap, not a security issue (the persisted session itself is fine) — **not fixed in this PR** since it's a behavioral/product decision (skip straight to dashboard? land on last-viewed tab? confirm identity first?), not a tiny consistency fix.
- **Owning ticket / backend dependency**: web session persistence → **backend-blocked**, needs the candidate OTP-verify endpoint to set an httpOnly cookie (no ticket currently tracks this explicitly; recommend a new ticket, see §"Recommended next ticket"). Mobile cold-launch routing → frontend-only, recommend a small follow-up under MPS-F201 or a new ticket (see recommendation section).

### 1.5 Staff login and role-based access

- **Audience/role**: staff (`admin`, `hr`, `mps`, `finance`, `management` — `descon-be`'s `User::STAFF_ROLE_CODES`, mirrored exactly in `shared/auth/staffTypes.ts`).
- **Route/source**: web-only, `/admin/login` (`web/src/app/admin/login/page.jsx`), email+password (confirmed: no CNIC/OTP UI present). Guard: `web/src/features/staffAuth/RequireStaffAuth.tsx`, wrapping every `/admin/*` screen via `web/src/app/components/staff-shell.tsx`.
- **API**: `shared/auth/realStaffAuthClient.ts` → `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `DELETE /api/v1/auth/logout`, `GET /api/v1/users/profile`. All four confirmed present in `openapi.yaml`.
- **Auth/permission model**: permissions are fetched from the backend (`GET /users/profile`'s `permissions` array) and **never derived from role client-side** (confirmed by code comment and cross-checked against backend Pundit policies, which gate on named permission strings like `manage_staff_users`, not role). `RequireStaffAuth` redirects unauthenticated visitors to `/admin/login` and authenticated-but-under-permissioned staff to `/admin/forbidden` (`web/src/app/admin/forbidden/page.jsx`) — verified this is a real redirect, not just a hidden/disabled UI, via dedicated tests on both the guard and each gated screen (e.g. "redirects a non-admin... to the forbidden route, never rendering the table").
- **States**: field-level validation, a single generic auth error (never reveals whether the email exists), rate-limited message, network-error message, inactive-account message (distinct from bad credentials), a `restore-error` state on the guard itself (session-restore failed due to connectivity) with an explicit retry action.
- **EN/UR/RTL**: fully translated (staff screens are allowed to remain English-only per AGENTS.md, but nothing was found hardcoded — the translation coverage exists regardless).
- **Classification**: **implemented**. This is one of the most thoroughly tested flows in the codebase (10 page-level tests, 6 guard tests, 6 `useStaffSignIn` tests, 15 `StaffAuthContext` tests covering proactive token refresh, race conditions between a slow restore and a manual login/logout, and offline resilience).
- **Owning ticket**: MPS-F202/MPS-F203 (staff auth + admin) / MPS-F204 (backend wiring), all already merged per the branch history.

---

## 2. Candidate Dashboard

- **Audience/role**: candidate.
- **Route/source**: web `/dashboard` (`web/src/app/dashboard/page.jsx`); mobile `(tabs)/dashboard` (`mobile/src/app/(tabs)/dashboard/index.jsx`).
- **API**: composes three real endpoints via `useCandidateProfile`, `useCandidateDocuments`, `useApplicationProgress` — `GET /candidate/profile`, `GET /candidate/documents`, `GET /candidate/application_progress`. All confirmed real and already covered under MPS-501/MPS-F302 integration.
- **Auth**: `RequireAuth`-guarded (mobile) / query-level 401 handling (web) — candidate bearer token.
- **States**: full `Loading → SessionExpired → Forbidden(inactive-account) → Offline → Error → content` dispatch on both platforms (added in MPS-F302, fixed for a cross-query error-priority bug and a refresh re-entrancy race in the same ticket's follow-up commit). Mobile pull-to-refresh awaits all three queries with a single indicator and a `useRef`-guarded duplicate-trigger lock.
- **EN/UR/RTL**: full, including the "Make Payment" tile's disabled/"Coming soon" state (see §9).
- **Responsive/accessibility**: web has explicit responsive utility classes; the disabled payment tile carries `aria-disabled`/`accessibilityState={{disabled:true}}`.
- **Classification**: **implemented**.
- **Owning ticket**: MPS-F302 (merged, PR #15).

---

## 3. Document capture, upload, replacement, submission, validation, review status

- **Audience/role**: candidate.
- **Route/source**: web `/documents` (`web/src/app/documents/page.jsx` + `web/src/features/candidate/documents/`); mobile `(tabs)/documents` (`mobile/src/app/(tabs)/documents/index.jsx` + mirrored feature folder).
- **API**: `GET /candidate/documents` (checklist), `POST /candidate/documents` (upload/replace), `POST /candidate/document_submissions` (batch submit for review). All confirmed real.
- **Auth**: candidate bearer token; `replacementAllowed` is read directly from the backend response and never inferred from status client-side (explicitly tested on both platforms).
- **States**: loading, **empty checklist** (fixed in MPS-F401 — was previously rendering nothing, despite the `candidateDocumentsEmptyTitle`/`Description` translation keys existing unused), offline, session-expired, inactive-account, generic error+retry, per-row upload states (validation error, uploading — an honest indeterminate spinner, never a fabricated percentage, since the transport genuinely has no progress signal), idempotency-conflict, replacement-not-allowed, rejected (with reason), expired/near-expiry PCC (with a re-collected issue date on replace), and a duplicate-submission guard tested via a true synchronous re-entrancy test.
- **Capture (mobile only)**: camera + gallery capture via `expo-image-picker`, with granted/denied/permanently-blocked permission handling (Open Settings action), scoped to physically-photographable requirement types only (`shared/candidateDocuments/captureEligibility.ts` — excludes `cv`, `experience_letter`, `certificates`, which keep only "Choose file"). Local image preview on both platforms (object URL on web, revoked on replace/unmount; local file URI on mobile, no cleanup needed).
- **Cache sync**: upload/replace success invalidates `applicationProgress` on both platforms (fixed in MPS-F401 — previously only the checklist cache was patched, leaving Dashboard/Status/Profile stale until their own next refetch).
- **EN/UR/RTL**: full, including all new capture/permission/guidance strings.
- **Classification**: **implemented**. This is the most heavily tested screen in the codebase (54 web tests, 41 mobile tests as of MPS-F401) and was the direct subject of the two most recent tickets.
- **Owning ticket**: MPS-409 → MPS-F403 (document review sync) → MPS-F401 (this branch's immediate predecessor, merged as PR #16).

---

## 4. Candidate Status page (15 stages, history, QVC)

- **Audience/role**: candidate.
- **Route/source**: web `/status` (`web/src/app/status/page.jsx`); mobile `(tabs)/status` (`mobile/src/app/(tabs)/status/index.jsx`).
- **API**: `GET /candidate/application_progress` (embeds the `workflow` timeline snapshot) and `GET /candidate/workflow_history` (transition-by-transition evidence, including QVC outcome). Both confirmed real and matched against the backend's `WorkflowStage::CANONICAL_STAGES` (all 15 stages, confirmed unchanged: `registered` → `documents_pending` → `documents_uploaded` → `under_verification` → `verified` → `fee_pending` → `fee_paid` → `documents_shared_with_qatar_bu` → `qvc_appointment_booked` → `qvc_completed_outcome_received` → `visa_issued_or_rejected` → `appeared_for_protection` → `protected_ready_to_fly` → `flight_details_uploaded` → `mobilized`).
- **Auth**: candidate bearer token.
- **States**: loading, offline, session-expired, inactive-account, generic error+retry. Mobile pull-to-refresh refetches *both* `application_progress` and `workflow_history` (a real bug caught and fixed mid-session during MPS-501: the refresh handler originally only refetched the progress query after the history query was added).
- **QVC data**: the candidate's own `workflow_history` response can include `qvc_outcome_code` (`approved`/`re_medical_required`/`rejected`) and `qvc_outcome_date` once that transition has actually occurred — the candidate never sees the `actor` (which staff member performed it), which is admin-only. The frontend renders this via `findLatestQvcOutcome`/`QVC_OUTCOME_KEYS`/`QVC_OUTCOME_TONES` (`shared/candidateWorkflow/qvcOutcome.ts`), never inventing a decision the backend hasn't recorded.
- **EN/UR/RTL**: full.
- **Classification**: **implemented**.
- **Owning ticket**: MPS-501 (merged), stage-name/dashboard consistency fixed under MPS-F302.

---

## 5. Candidate Profile

- **Audience/role**: candidate.
- **Route/source**: web `/profile`; mobile `(tabs)/profile`.
- **API**: `GET /candidate/profile` + `GET /candidate/application_progress` (for the document-status summary row).
- **States**: full `Loading → SessionExpired → Forbidden → Offline → Error → content` dispatch on both platforms, confirmed clean during the MPS-F302 audit (no changes were needed).
- **EN/UR/RTL**: full — **three small RTL bugs fixed in this PR** (web `profile/page.jsx`: `mr-3`→`me-3` ×2, `ml-2`→`ms-2`, `text-left`→`text-start`, and a hardcoded `ChevronRight` on the language row now flips to `ChevronLeft` under Urdu, matching the pattern the Documents screen already used correctly). Mobile had five equivalent literal `marginLeft`/`marginRight` occurrences across Dashboard/Status/Profile — all fixed in this PR (`marginStart`/`marginEnd`); a repo-wide grep after the fix confirms zero remaining `marginLeft`/`marginRight`/`paddingLeft`/`paddingRight` literals anywhere in `mobile/src`.
- **Classification**: **implemented** (now, with the RTL fixes above — was **partial** before this PR for the reasons just listed).
- **Owning ticket**: MPS-F302 (base implementation, merged); RTL fixes are part of this PR's "tiny, clearly safe" allowance.

---

## 6. Staff login and role-based access

Covered fully in §1.5 above (staff auth and role gating are one flow, not a separate screen).

---

## 7. Staff user management and document-review screens

### 7.1 Staff user management — `/admin/users`

- **Route/source**: `web/src/app/admin/users/page.jsx`, gated `permission="manage_staff_users"` (backend: `Admin::UserPolicy#index?/create?/update?`, matching).
- **API**: `staffDirectoryClient` (`web/src/lib/staff-directory-client.ts`) — **in production, this resolves to `createUnavailableStaffDirectoryClient()`, which always fails safely rather than calling the network at all.** The real backend endpoints this screen's UI concepts map to (`GET/POST /api/v1/users`, `PATCH /api/v1/users/{id}`) **do exist** in `openapi.yaml` with matching request/response shapes (role, `staff_state: invited/active/suspended`, last-admin/self-suspension validation) — but the frontend client has never been wired to call them. The code's own comment names this explicitly: *"No real MPS-205 backend is wired up yet."*
- **States**: loading/error(+retry)/empty all present and tested against the **mock** client only.
- **EN/UR/RTL**: full.
- **Classification**: **partial** (backend contract appears ready; frontend integration explicitly stubbed out). This reads as `backend-blocked` from the frontend engineer's perspective (the ticket comment implies the backend wasn't ready when this was built), but the OpenAPI evidence suggests the contract exists now — **recommend verifying the real endpoint against this screen's expectations and wiring `staffDirectoryClient` for real**, rather than assuming further backend work is required. This is the single most actionable, well-scoped candidate for the next frontend ticket (see recommendation section).
- **Owning ticket**: referenced in-code as MPS-205 (backend) — the frontend wiring itself doesn't yet have a distinct ticket number in this repo's history.

### 7.2 Document review queue — `/admin/document-reviews`

- **Route/source**: `web/src/app/admin/document-reviews/page.jsx` + `DocumentReviewQueue.tsx`, gated `permission="manage_candidate_documents"`.
- **API**: `adminDocumentReviewsClient` → `GET /admin/document_submissions{query}` — confirmed real.
- **States**: loading, offline, forbidden (`review_not_allowed`), session-expired/inactive-account (hands off to `signOut()`), generic error+retry, two distinct empty states (true-empty vs filtered-empty), rate-limited, and a **background-refresh-failed banner that preserves stale-but-usable cached data** (`RetryBanner`) rather than blanking the screen — a real, correctly-implemented instance of the AGENTS.md requirement to preserve cached data on background refresh failure.
- **EN/UR/RTL**: full, including locale-aware date formatting.
- **Classification**: **implemented**. Largest test suite of any staff screen (queue states, filters/URL state, pagination, compliance summary, Urdu).
- **Owning ticket**: MPS-F403 (document review sync, merged).

### 7.3 Document submission detail — `/admin/document-reviews/:id`

- **Route/source**: `web/src/app/admin/document-reviews/[id]/page.jsx` + `SubmissionDetail.tsx`, same permission.
- **API**: `GET /admin/document_submissions/{id}`, `POST /admin/candidate_documents/{id}/access` (short-lived private preview, requested only on explicit click — never eagerly, never a public URL), `POST .../verifications`, `POST .../rejections`. All confirmed real, all support `Idempotency-Key`.
- **States**: session-expired/inactive-account handling from **any of three independent operations** (submission load, preview access, decision mutation) — explicitly fixed as a prior bug per its own code comments. Never renders a raw reviewer role or internal ID; falls back to a safe generic label for an unrecognized reviewer role.
- **Classification**: **implemented**. Largest and most defensively-tested screen in the codebase (safe-metadata-display, session-ending-from-any-operation, and secure-preview-race-safety are each their own test groups).
- **Owning ticket**: MPS-F403 (merged).

---

## 8. Admin candidate registry and workflow-management screens

### 8.1 Admin dashboard (candidate registry) — `/admin`

- **Route/source**: `web/src/app/admin/page.jsx`. Auth-gated only (any authenticated staff role — no `permission` prop).
- **API**: raw, **unauthenticated** `fetch("/api/stats")` / `fetch("/api/candidates?...")` — these are Next-style mock routes inside `web/src/app/api/*`, backed entirely by an in-memory store (`web/src/app/api/utils/mock-db.js`). **No corresponding real backend endpoint exists** (`openapi.yaml` has no `/candidates` list or `/stats` path at all).
- **States**: loading and an empty-results message only — a fetch error and a genuine empty result are visually indistinguishable (both just show "no candidates found"), since the `catch` block only logs to console.
- **Classification**: **missing** (as a real feature — what renders is a fully mock prototype, not a partial integration). Also contains a **dead link**: an "Add candidate" control points at `/admin/candidates/new`, which has no corresponding `page.jsx` anywhere in the repo and resolves to the catch-all not-found route.
- **Backend dependency**: needs a real `GET /api/v1/admin/candidates` (list/search) endpoint — does not exist today in any form (not even a stub).
- **Owning ticket**: recommend a new ticket, e.g. **MPS-F304 "Admin candidate registry: real backend integration"** — out of scope for this branch per its own exclusions.

### 8.2 Admin candidate detail — `/admin/candidates/:id`

- **Route/source**: `web/src/app/admin/candidates/[id]/page.jsx`. Auth-gated only at the page level; the Verify/Reject buttons are additionally gated in-component on `manage_candidate_documents`.
- **API**: raw `fetch(/api/candidates/${id})` and `fetch(/api/documents/${id}/verify, ...)` — same mock-db backing, **no auth header attached**, and **functionally duplicates** the already-real `document-reviews/[id]` screen's verify/reject capability with a completely disconnected, unauthenticated implementation. No matching OpenAPI path exists for either call.
- **States**: loading + a not-found-shaped empty guard that also silently absorbs genuine fetch errors (same "error looks like empty" gap as §8.1). Rejection reason capture uses a native `prompt()`; verify/reject failure uses a native `alert()` — both bypass the design system's dialog/toast components entirely.
- **Workflow-stage display**: the "Timeline" section on this page is **read-only** — it displays mock `timeline` data with no action of any kind to change a candidate's stage.
- **Classification**: **missing** (mock prototype, and a second, disconnected implementation of functionality the real `document-reviews` screens already do correctly).
- **Backend dependency**: needs the same real candidate-detail endpoint as §8.1, and should be re-pointed at the *existing, real* `adminDocumentReviewsClient` for verify/reject rather than reimplementing it.
- **Owning ticket**: same recommendation as §8.1 (MPS-F304), plus explicitly retiring the duplicate verify/reject code path in favor of the one `document-reviews/[id]` already uses correctly.

### 8.3 Admin workflow-management screen

- **Confirmed: does not exist anywhere in the frontend.** `grep -rln "workflow_transitions|workflow_state|workflow_history|AdminWorkflowTransition" web/src shared` returns only the **candidate-side** self-service client (`shared/candidateWorkflow/`) — there is no `shared/adminWorkflow/` directory, no admin workflow API client, and no `permission="manage_workflow"`/`"view_workflow"` reference anywhere in `web/src`.
- **Backend readiness**: the backend is fully built and documented for this — `GET/POST /api/v1/admin/candidates/{id}/workflow_transitions` (list allowed next transitions with blocking reasons; perform a transition), `GET .../workflow_state`, `GET .../workflow_history`, gated by `Admin::CandidateWorkflowPolicy` (`view_workflow` to read, `manage_workflow` to transition) — and the mock staff role→permission fixture already assigns `manage_workflow` to `mps` and `view_workflow` to `management`, suggesting this was anticipated but never built on the frontend.
- **Classification**: **missing** — this is the single clearest example of a real, ready backend capability with zero frontend surface anywhere.
- **Owning ticket**: recommend a new ticket, e.g. **MPS-F305 "Admin workflow-management screen"** (explicitly excluded from this branch's own scope, per its restriction against starting new feature work — recorded here as required by the ticket, not started).

---

## 9. Payment and notification screens

### 9.1 Payment

- **Candidate-facing**: no payment UI exists. The only surface is a **visibly disabled** "Make Payment" dashboard tile on both web and mobile (`disabled: true`, no handler, "Coming soon" sub-label) — this is intentional, correct behavior per MPS-F302's explicit exclusion of KuickPay/payment work, not a gap.
- **Staff-facing**: `admin/page.jsx` and `admin/candidates/[id]/page.jsx` both display **read-only** payment-record sections/stat tiles — but these are sourced entirely from the same fake mock-db as the rest of those two screens (§8.1/8.2), not real data.
- **Backend**: a `Payment` model and `payments` table already exist in the Rails schema (`descon-be/app/models/payment.rb`), and `CandidateWorkflows::PrerequisiteValidator` already reads it (`payments.where(status_code: 'paid')...`) to decide whether the `fee_paid` stage transition is unblocked — but **there is no controller, route, or any application code path that ever writes a `Payment` row**. Today, a candidate's fee can only ever be marked paid by direct database/console access. No KuickPay reference exists anywhere in the codebase outside a single generic mention in `descon-be/AGENTS.md`'s "isolate vendor integrations" rule.
- **Classification**: **backend-blocked** in the strictest sense — there is no payment-recording endpoint to build a frontend against at all, on either the candidate or staff side. Confirms MPS-F302's explicit exclusion was correct and should remain excluded until a payment-recording backend ticket exists.
- **Owning ticket**: no current ticket owns "build the payment-recording backend + admin UI to record it + wire the fee-paid check end-to-end" — recommend this be scoped as its own backend-first ticket before any frontend payment ticket (MPS-F501, already named in this ticket's own exclusions) is started.

### 9.2 Notifications

- **Confirmed: nothing exists.** Zero matches for "notification"/"alert"/"inbox"/"push_token"/"device_token" anywhere in `web/src`, `mobile/src`, or `descon-be/openapi/openapi.yaml`. The only related UI is the generic one-off `toast` utility (`design-system/toast.ts` on both platforms) used to announce a single action's own outcome (e.g. "Document uploaded") — never a persisted notification list, badge count, or inbox screen.
- **Classification**: **missing**, with **no backend contract at all** to build against — this is backend-blocked from the ground up.
- **Owning ticket**: no ticket currently owns this. Recommend scoping a notifications feature (backend model + endpoint + frontend inbox/badge) as a new ticket only once product defines what a candidate/staff notification actually needs to contain (e.g. "document rejected," "workflow stage advanced") — premature to design the frontend before that contract exists.

---

## Recommended next frontend ticket(s), once dependencies are ready

1. **Wire `staffDirectoryClient` to the real backend** (§7.1) — the OpenAPI contract for `GET/POST /api/v1/users` and `PATCH /api/v1/users/{id}` already appears to match this screen's expectations; this needs verification against the live backend and then removing the `createUnavailableStaffDirectoryClient()` production fallback. **This is ready today** and is the lowest-risk, highest-value next ticket of everything found in this audit.
2. **MPS-F304 — Admin candidate registry: real backend integration** (§8.1/8.2) — replace both mock-backed admin screens with real endpoints once a `GET /api/v1/admin/candidates` (list) and equivalent detail endpoint exist; retire the duplicate, unauthenticated verify/reject implementation on the candidate-detail page in favor of the existing, correct `document-reviews/[id]` client. Also fix the dead `/admin/candidates/new` link once that screen exists (or remove the link if creating candidates will never be a UI flow).
3. **MPS-F305 — Admin workflow-management screen** (§8.3) — the backend (`workflow_transitions` list + create, permission-gated) is fully ready; no frontend work has started.
4. **Web candidate session persistence** (§1.4) — needs a backend change (httpOnly `Set-Cookie` on OTP verify) before any frontend work is possible; recommend filing this as a backend ticket first.
5. **Mobile cold-launch routing** (§1.4) — a frontend-only fix (skip Welcome/Login when a valid session is already restored), small enough to be its own quick ticket once a product decision is made about exactly where a returning candidate should land.
6. **Payment-recording backend** (§9.1) and **notifications** (§9.2) — both need their backend contracts designed and built from scratch before any frontend ticket (MPS-F501 and a not-yet-numbered notifications ticket) can start, matching this ticket's explicit exclusion of both.

---

## Verification

- No code changes beyond the "tiny, clearly safe" fixes listed in §1.4 (comment correction) and §5 (RTL literals on web `profile/page.jsx` and across mobile `dashboard`/`status`/`profile`) — see the PR's test/lint results for confirmation these introduced no regressions.
- All classifications above were reached by reading the actual route file, its real API client, and cross-checking the client's request path against `descon-be/openapi/openapi.yaml` — never from a screen's visual completeness alone.
