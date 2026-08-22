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

Both apps currently run on mock/in-memory data for their candidate and admin
prototype screens. A centralized API client exists in each app
(`src/lib/api-client.ts`, thin wrappers around `shared/api-client.ts`) as a
foundation for the upcoming Rails API integration, but it is not wired into
any screen yet.

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

- Candidate and admin prototype routes (web: `/`, `/login`, `/dashboard`,
  `/documents`, `/payment`, `/profile`, `/status`, `/admin`,
  `/admin/candidates/:id`; mobile: welcome → language select → login/OTP →
  dashboard/documents/status/profile tabs) are preserved as approved —
  don't restructure them without a product decision.
- The admin dashboard's data (`web/src/app/api/*`) is backed by an
  in-memory mock store (`web/src/app/api/utils/mock-db.js`), not a
  database. The frontend does not connect to a database directly.
- `web/src/lib/api-client.ts` and `mobile/src/lib/api-client.ts` both wrap
  `shared/api-client.ts` (the actual request/error-normalization logic,
  including the Rails `ErrorEnvelope` contract) with their own base-URL
  convention — not yet imported by any screen.
- `web/src/contexts/LanguageContext.tsx` and
  `mobile/src/contexts/LanguageContext.jsx` both wrap `shared/i18n/` (the
  translation catalog, RTL/locale helpers, and missing-key-warning lookup)
  with their own persistence (`localStorage` / `AsyncStorage`) and RTL
  application (`document.dir` / `I18nManager`).
