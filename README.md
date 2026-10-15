# Descon Manpower Service frontend

Two independent applications for the Manpower Onboarding portal, set up
separately, plus a small `shared/` directory of platform-independent code
they both import.

- `web/` — Descon Manpower Service (Descon MPS) public home and staff portal.
  React Router v7 + Vite builds a static single-page app (`ssr: false`; the
  Hono server runs only under `npm run dev`). Candidate web screens remain
  temporarily for synthetic-data testing; see
  [`docs/descon-mps-home-review.md`](docs/descon-mps-home-review.md) for their
  planned removal.
- `mobile/` — Descon Connect, the candidate-facing Expo / React Native app.
- `shared/` — portable TypeScript with no platform dependencies: the API
  client's request/error-normalization logic (`api-client.ts`) and the
  English/Urdu translation catalog and locale helpers (`i18n/`). Each app
  wraps these with its own platform configuration (env-based base URL,
  storage-backed language persistence) rather than importing UI from here.

The candidate-facing flow (login/OTP, dashboard, documents, status, profile)
and most staff/admin screens (staff login, staff user management, candidate
CSV import, document-review queue and detail) are wired to the real Rails
API via a centralized client in each app (`src/lib/api-client.ts`, thin
wrappers around `shared/api-client.ts`). The two screens that used to call the
in-memory prototype mock API — the admin candidate list
(`web/src/app/admin/page.jsx`) and the candidate detail/document-verification
screen (`web/src/app/admin/candidates/[id]/page.jsx`) — are now wired to the
real backend as well; `web/src/app/api/*` (the prototype's mock routes) is
referenced by no screen and runs only under `npm run dev`.

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
npm run build        # static SPA -> build/client (no server bundle)
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
through these variables. For web the value is **baked into the build** (Vite
inlines `VITE_*` at build time), so changing the public address means a new
build and deploy.

## Deployment

The admin web app is deployed to the AWS EC2 instance as a tested static
artifact with Capistrano — see
[`docs/deployment/static-spa.md`](docs/deployment/static-spa.md) (build,
deploy, rollback, continuous delivery, and what is and is not verified).

## Candidate session and refresh

The candidate access token lasts 15 minutes, but candidates are not asked for a
new SMS OTP that often. Web and mobile both renew the session through
`POST /api/v1/candidate/auth/refresh` (`refreshSession` in
`shared/auth/realCandidateAuthClient.ts`):

- The `AuthProvider` on each platform checks every 5 seconds and renews the
  session once the access token is within 60 seconds of expiring. The refresh
  token is single-use; each renewal returns a new pair.
- Only a server-confirmed rejection of the refresh token (401/403) signs the
  candidate out. Offline or network errors keep the session and retry on the
  next tick.
- **Mobile** persists the session in `expo-secure-store`. If the access token
  lapsed while the app was closed, launch renews it from the stored refresh
  token instead of showing the login screen. The refresh token is valid for 30
  days from its last use (backend `CANDIDATE_REFRESH_TOKEN_EXPIRY_DAYS`), so
  candidates who open the app at least monthly stay signed in.
- **Web** keeps the session in memory only, so it is renewed while the tab is
  open, but a page reload still returns to the login screen.
- The mobile `AuthProvider` takes the client as a prop (`client`); the app root
  (`mobile/src/app/_layout.jsx`) passes the real one. Without it, an expired
  stored session is discarded.

## Project structure notes

- The web root (`/`) is the public Descon MPS home, with staff routes under
  `/admin`. Candidate routes including `/candidate-preview`, `/login`,
  `/dashboard`, `/documents`, `/profile`, `/status`, `/consent`, and the
  `/payment` paths remain temporarily reachable for testing. Their planned
  removal is documented in `docs/descon-mps-home-review.md`. The existence of
  a payment page does not establish a verified live payment flow. The Descon
  Connect mobile app keeps its candidate onboarding flow independently.
- The admin portal's navigation shell (`web/src/app/components/staff-shell.tsx`)
  was redesigned from a horizontal top bar with dropdown menus to a persistent
  left sidebar (collapsing to a slide-in drawer below the `lg` breakpoint) as
  part of a full admin-portal visual redesign — supersedes MPS-F902's original
  top-nav grouping decision; see the admin-portal redesign plan for the full
  scope (sidebar shell, dashboard charts, list/detail page restyling) and
  status of each phase.
- Every screen is wired to real, documented `descon-be` endpoints. The
  prototype's in-memory mock API (`web/src/app/api/*`, `mock-db.js`) is
  development-only and unreferenced; the production build is a static SPA, so
  it is not part of what is deployed (see `docs/deployment/static-spa.md`).
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
