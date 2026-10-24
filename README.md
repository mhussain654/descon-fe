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
- `mobile/` — MPS Connect, the candidate-facing Expo / React Native app.
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

In the mobile dashboard, **Help & Support** calls the phone number from the
staff portal's **Help & support** settings (`/admin/support-settings`). The
**Training** settings (`/admin/training-settings`) control the separate
training link and do not set the support phone. After saving a support number,
return to the dashboard or pull to refresh to fetch the latest value. A blank
support number leaves the action unavailable.

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

The web app is built as a static SPA and served by Nginx on the shared EC2
instance. Mobile is distributed separately. The API and web use the same
public origin, `https://descon-mps.com`; a web build bakes in
`https://descon-mps.com/api/v1`.

### Deploy from your machine

Use a committed checkout, Ruby and Bundler (for Capistrano), Node.js 20+,
and an SSH key authorized for `deploy@52.221.51.231`. Your IP must be allowed
by the EC2 SSH security group, and you must trust the instance host key.
Configure that key in `~/.ssh/config` or your SSH agent. The server's GitHub
repository keys and AWS credentials are not needed on your machine.

```bash
git switch main
git pull --ff-only origin main
cd deploy
bundle install
PUBLIC_ORIGIN=https://descon-mps.com bundle exec cap production deploy
```

The Capistrano task runs `npm ci`, typecheck, tests, builds the static
artifact, and verifies it before publishing. To deploy a different *committed*
branch locally, check it out first, then run the same command from `deploy/`.
The build is made from your checked-out commit, so confirm `git rev-parse HEAD`
and use a clean working tree. To restore the preceding web release:

```bash
cd deploy
bundle exec cap production deploy:rollback
```

### Deploy from GitHub Actions

Open this repository's **Actions → EC2 Deploy → Run workflow**. Select the
workflow's branch (`main` for a production deployment; for a `branch` deployment, the
branch you want to deploy, which must contain this workflow file), then choose `source`:

| Source | Additional input | GitHub environment | Result |
| --- | --- | --- | --- |
| `main` | None | `production` | Latest `main` commit |
| `branch` | None: the branch picked in **Use workflow from** (not `main`) | `preview` | Tip of that branch |
| `pull_request` | Open PR number from this repository | `preview` | Head commit of that PR; fork PRs are refused |

A push or merge to `main` also starts EC2 Deploy automatically. It builds the
exact commit and waits for the `production` environment reviewer before
delivery. It does not re-run tests or lint: CI does that on every pull request
and push, so make CI a required check on `main`. A branch push or PR opening does **not** deploy automatically;
start those with **Run workflow** and obtain `preview` approval. Check the
**Build** and **Deploy** jobs and the SSM result; a green tests job alone is
not evidence that a release was installed. Production deployment needs
repository variables `EC2_INSTANCE_ID`, `PUBLIC_ORIGIN`, `ARTIFACT_BUCKET`,
and the `production` environment's `AWS_DEPLOY_ROLE_ARN` (the `preview`
environment needs its own role ARN). Never put AWS access keys in GitHub.

**Preview changes the same public site** and talks to the same Rails/RDS/S3.
After a preview, run a `main` deployment to restore the main web build. The
frontend and backend can be released independently, but share a server-side
deploy lock.

### Pause or resume GitHub deployments

To stop **both** automatic and manual GitHub deployments, open **Actions →
EC2 Deploy → ⋯ → Disable workflow**. Use **Enable workflow** on that page to
resume. Cancel any already running deployment separately; disabling does not
undo an installed release. Local Capistrano remains available. To retain
manual deployments but stop automatic `main` deployments, make a reviewed PR
that removes the `push` trigger from `.github/workflows/deploy.yml`, leaving
`workflow_dispatch`; restore the trigger in another PR to re-enable it. Keep
the GitHub environment approval rules intact.

For first-time AWS setup, artifact verification, health checks and rollback
details, see [`docs/deployment/static-spa.md`](docs/deployment/static-spa.md).

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
