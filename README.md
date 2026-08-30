# Descon Frontend

Two independent applications for the Manpower Onboarding portal, set up
separately, plus a small `shared/` directory of platform-independent code
they both import.

- `web/` — React Router v7 + Vite (SSR via Hono). Browser app covering both
  the candidate onboarding flow and the internal admin dashboard.
- `mobile/` — Expo / React Native. Candidate-facing native app.
- `shared/` — portable TypeScript with no platform dependencies: the API
  client's request/error-normalization logic (`api-client.ts`) and the
  English/Urdu translation catalog and locale helpers (`i18n/`). Each app
  wraps these with its own platform configuration (env-based base URL,
  storage-backed language persistence) rather than importing UI from here.

The candidate-facing flow (login/OTP, dashboard, documents, status, profile)
and most staff/admin screens (staff login, staff user management, candidate
CSV import, document-review queue and detail) are wired to the real Rails
API via a centralized client in each app (`src/lib/api-client.ts`, thin
wrappers around `shared/api-client.ts`). Two admin screens are still
prototype/mock-only, calling an in-memory mock API
(`web/src/app/api/*`/`mock-db.js`) instead of the real backend: the admin
dashboard candidate list (`web/src/app/admin/page.jsx`) and the candidate
detail/document-verification screen
(`web/src/app/admin/candidates/[id]/page.jsx`) — see the MPS-F001 UX
inventory (`docs/mps-f001-ux-inventory.md`) for the exact gap and its
recommended follow-up ticket.

## Prerequisites

- Node.js 20+ (`node -v` — an older Node earlier in your `PATH` will produce
  confusing syntax/module-resolution errors that look unrelated to Node)
- npm
- For mobile: the Expo Go app, or an iOS/Android simulator

## Web

```bash
cd web
cp .env.example .env
npm install
npm run dev         # http://localhost:4000 (admin dashboard at /admin)
```

Other scripts:

```bash
npm run typecheck
npm run build        # production build (build/client, build/server)
npm test             # vitest
```

## Mobile

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` to your development
machine's LAN IP (not `localhost`) — a physical device or simulator can't
reach the host machine's `localhost` directly.

Other scripts:

```bash
npm run typecheck
npm test              # jest
```

## Environment variables

Each app's `.env.example` is the source of truth for what it reads. The one
shared convention across both:

| App    | Variable                    | Purpose                                   |
| ------ | ---------------------------- | ------------------------------------------ |
| web    | `VITE_API_BASE_URL`          | Base URL for the Rails API                 |
| mobile | `EXPO_PUBLIC_API_BASE_URL`   | Base URL for the Rails API                 |

Neither app should ever contain a hardcoded production API URL — always go
through these variables.

## Project structure notes

- Candidate and admin routes (web: `/`, `/login`, `/dashboard`,
  `/documents`, `/profile`, `/status`, `/admin`, `/admin/login`,
  `/admin/forbidden`, `/admin/users`, `/admin/candidates/:id`,
  `/admin/candidates/import`, `/admin/document-reviews`,
  `/admin/document-reviews/:id`; mobile: welcome → language select →
  login/OTP → dashboard/documents/status/profile tabs) are preserved as
  approved — don't restructure them without a product decision. There is no
  `/payment` route (removed in MPS-F302 — it was a fully mocked page with no
  working action); the candidate dashboard shows a visibly-disabled "Coming
  soon" tile instead. `admin/page.jsx` links to `/admin/candidates/new`,
  which does not exist (resolves to the catch-all not-found route) — see the
  UX inventory for the recommended follow-up.
- Two admin screens (`web/src/app/admin/page.jsx` and
  `web/src/app/admin/candidates/[id]/page.jsx`) still call an in-memory mock
  API (`web/src/app/api/*`, backed by `web/src/app/api/utils/mock-db.js`)
  instead of the real Rails backend — everything else (candidate auth/
  dashboard/documents/status/profile, staff login, staff user management,
  candidate CSV import, document-review queue/detail) is wired to real,
  documented `descon-be` endpoints.
- `web/src/lib/api-client.ts` and `mobile/src/lib/api-client.ts` both wrap
  `shared/api-client.ts` (the actual request/error-normalization logic,
  including the Rails `ErrorEnvelope` contract) with their own base-URL
  convention, and are imported by every real (non-mock) screen's own typed
  client (e.g. `auth-client.ts`, `candidate-documents-client.ts`,
  `staff-auth-client.ts`, `admin-document-reviews-client.ts`).
- `web/src/contexts/LanguageContext.tsx` and
  `mobile/src/contexts/LanguageContext.jsx` both wrap `shared/i18n/` (the
  translation catalog, RTL/locale helpers, and missing-key-warning lookup)
  with their own persistence (`localStorage` / `AsyncStorage`) and RTL
  application (`document.dir` / `I18nManager`).
