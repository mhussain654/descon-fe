# Admin web app: static SPA deployment

> **Preview shares the live test site.** Both GitHub environments deploy the
> web build to `/home/deploy/descon-mps-web/current` on the same EC2 instance.
> A branch or PR preview replaces the site served at the public address and
> calls the same Rails API backed by shared RDS and S3. A later `main` deploy
> replaces its build. Use a separate preview site and backend before treating
> preview as isolated staging.

The admin portal (`web/`) is built as a static single-page app and served by
Nginx from `/home/deploy/descon-mps-web/current` on the same EC2 instance as the
Rails API. There is no Node or Hono process in production, no Amplify and no
Docker. Mobile (`mobile/`) is built and distributed separately and is not
affected.

Backend and host setup (Nginx, TLS, systemd, the shared deploy lock) live in
`descon-be`: `docs/deployment/aws-ec2-runbook.md`. Its Nginx access instructions grant `www-data` read access to the web release under `/home/deploy` without exposing API secrets.

## 1. Why a static build is safe here

Checked against this repository, not assumed:

| Question | Finding |
|---|---|
| Does any route have a server `loader`/`action`? | None (`grep -rE "export (async )?function (loader|action)" web/src` is empty). Every screen loads data in the browser. |
| Does any screen call the Hono mock API? | No. There are no relative `/api/...` fetches; every request goes through the shared API client to `VITE_API_BASE_URL`. |
| What is the Hono server then? | `src/app/api/**` is the original prototype's in-memory mock (`mock-db.js`, candidates/documents/timeline/stats). Nothing imports or calls it. It stays for `npm run dev` only. |
| The "two mock-only admin screens" | The README named `web/src/app/admin/page.jsx` (candidate list) and `web/src/app/admin/candidates/[id]/page.jsx` (candidate detail). **Both are API-backed; the README was stale and is corrected here.** `admin/page.jsx` was rebuilt for MPS-F303 and calls `GET /api/v1/admin/candidates`; the detail page renders `CandidateWorkspace`, which uses `useCandidateDetail` and the candidate fee, workflow, QVC, visa and document-submission endpoints. Both were exercised in a browser against the real API (§8). `support-settings` and `training-settings` are API-backed too. |
| Authentication | Staff and candidate sessions are client-side (token restore through `POST /api/v1/auth/refresh`); route guards are UX only, enforcement is the API's. |
| Anything that needs the server at runtime? | `window.location`-relative only. Document links are path-only `/rails/active_storage/…` URLs resolved against the API origin, which is the same origin. |

`/design-system` (the component showcase) is a public route in the build. It
contains no data, but you may want it removed or gated before real use.

## 2. What changed

* `web/react-router.config.ts`: `ssr: false`.
* `web/vite.config.ts`: the Hono plugin runs only for `vite serve`.
* `web/scripts/verify-static-build.mjs` (+ tests): SPA shell present, no server
  bundle, the intended API base URL baked in, no development address or mock
  code in the assets. A test keeps `ssr: false` from being flipped back.
* `deploy/`: Capistrano artifact deployment, `deploy/bin/build-artifact`,
  `deploy/bin/descon-deploy-web` (CD entry point), rehearsal driver, AWS
  templates.
* `.github/workflows`: CI verifies the static build, lints the scripts and runs
  the rehearsal; `deploy.yml` is the optional delivery path (choose main, a
  branch or a PR).

## 3. Build

```bash
cd web
npm ci
npm run typecheck
npm test
VITE_API_BASE_URL=https://<host>/api/v1 npm run build     # -> build/client
node scripts/verify-static-build.mjs --api-base https://<host>/api/v1 build/client
```

`VITE_API_BASE_URL` is baked into the JavaScript **at build time**. Changing
the public address means a new build and deploy; there is no runtime config.
The value must be the public API URL (`https://descon-mps.com/api/v1`);
it is never hard-coded in source, and the verifier fails a build that carries a
different value or a development default.

## 4. Deploy from an administrator machine

Prerequisites: Ruby (see the backend's `.ruby-version`), SSH access to the
instance as `deploy` from an allowed IP, the instance's host key in
`~/.ssh/known_hosts` (see the backend runbook), and the working tree committed
(the artifact must correspond to a commit; `ALLOW_DIRTY=1` is for throwaway
builds only).

```bash
cd deploy
bundle install
PUBLIC_ORIGIN=https://descon-mps.com bundle exec cap production deploy
```

What happens:

1. The host-wide lock is taken (`/home/deploy/.deploy-locks/descon-mps.lock`,
   shared with the backend). A concurrent backend or frontend deploy fails
   fast naming the holder.
2. `deploy/bin/build-artifact` runs `npm ci`, typecheck, the **full test
   suite**, the production build for `PUBLIC_ORIGIN`, and the verifier, then
   packs `build/client` and records its SHA-256 and the commit.
3. The artifact is uploaded, its SHA-256 is re-computed **on the server** and
   must match; only then is it unpacked into `releases/<timestamp>`.
4. `current` is switched (an atomic rename) — Nginx serves it with no reload.
5. The live site must serve the SPA shell and, once TLS exists, answer
   through Nginx on loopback. If not, `current` is restored to the release that
   was serving *before* this deploy, the failed release is deleted, and the
   command exits non-zero. Until that exact release answers healthily it says so.

A deploy never leaves a half-written site: nothing under `current` changes
until the whole artifact is verified and unpacked.

To deploy an artifact built elsewhere (for example by CI):
`ARTIFACT=<file> ARTIFACT_SHA256=<64 hex> REVISION=<40-char sha> bundle exec cap production deploy`.

Rollback: `bundle exec cap production deploy:rollback` (previous release,
health-checked).

## 5. Serving, caching and headers

The Nginx site (`descon-be/deploy/nginx/descon-mps.conf`) routes `/api/v1/` and
`/rails/active_storage/` to Rails, serves `/assets/*` as immutable (a missing
asset is 404, never the shell), and falls every other path back to
`index.html` (`no-store`) so deep links and refreshes work. API-looking paths
that are not the API answer 404, not HTML.

Security headers are added at Nginx (`X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). A
`Content-Security-Policy` is shipped **Report-Only**: React Router's SPA shell
contains four inline `<script>` blocks whose bytes change every build, so an
enforcing `script-src` needs per-build hashes (follow-up). HSTS is deliberately
absent while the site uses a 6-day IP-address certificate.

## 6. Public domain

Set `PUBLIC_ORIGIN=https://descon-mps.com` for local deploys and the GitHub
Actions repository variable to the same value before a CD build. The backend
runbook covers the certificate, CORS and return URLs. Rebuild the web app.

## 7. Continuous delivery: deploy a branch or a PR (optional)

**Actions → "Deploy admin web" → Run workflow** lets you choose what to deploy:

| `source` | What is deployed | Environment | Commit accepted by the instance |
|---|---|---|---|
| `main` (default) | the tip of `main` | `production` | only a commit already on `origin/main` |
| `branch` + branch name | the tip of that branch | `preview` | any commit on a branch of this repository |
| `pull_request` + number | the head of that **open, same-repository** PR | `preview` | same as above |

A push to `main` runs the `main` path automatically (still behind the
`production` environment's approval).

For every run `.github/workflows/deploy.yml`:

1. **resolves** the selection to one commit SHA and prints it in the run
   summary (a fork PR, a closed PR or an unknown branch fails here);
2. runs this repository's **CI on exactly that commit** (the reusable
   `ci.yml` with `ref` set) — typecheck, the full test suite, the static
   build check;
3. builds the artifact once from that commit for `PUBLIC_ORIGIN` and verifies
   it;
4. assumes the environment's AWS role through GitHub OIDC, uploads the artifact
   to a private bucket, and starts that environment's SSM document, passing the
   artifact's SHA-256 **through SSM** so a swapped object is detected;
5. on the instance `descon-deploy-web` re-verifies the checksum and runs the
   same Capistrano deploy an administrator runs, with the local backend, so the
   shared lock, health check and rollback are identical. A failure leaves the
   previous release live.

**Where the safety comes from.** Not from the workflow file — a branch can edit
it — but from controls a branch cannot change: the GitHub environment
(`production` limited to `main` and reviewed; `preview` reviewed), the AWS role
each environment assumes (the trust policy pins the OIDC `sub` to that
environment), and the SSM document that role may start (`DesconDeployWeb`
accepts only a commit on `origin/main`; `DesconDeployWebPreview` adds
`--any-pushed-commit`; each takes only a 40-hex SHA, a `web/<sha>.tar.gz` key
and a 64-hex checksum, so neither role can run an arbitrary command).

A preview deploy serves **the branch's own build** at the public origin and
talks to this host's real API. Anyone who can approve `preview` can put code
that someone with write access pushed in front of users. Fork pull requests
are never deployed. Keep that in mind before this origin serves real
candidates.

One-time setup (**not done, not exercised**):

1. A private S3 bucket (`descon-mps-deploy-artifacts`, or set
   `DESCON_ARTIFACT_BUCKET` in the root-owned script) with SSE-S3 and a 30-day
   lifecycle rule.
2. Instance role: `deploy/aws/instance-role-artifact-read-policy.json` (read
   `web/*`) and `AmazonSSMManagedInstanceCore`; install the AWS CLI.
3. Two IAM roles for the GitHub OIDC provider:
   `descon-fe-deploy-production` (trust
   `deploy/aws/github-oidc-trust-policy-production.json`, permissions
   `…/github-deploy-role-production-permissions.json`) and
   `descon-fe-deploy-preview` (the `-preview` pair).
4. Two SSM documents from `deploy/aws/ssm-document-DesconDeployWeb.json` and
   `…WebPreview.json`
   (`aws ssm create-document --name <name> --document-type Command
   --document-format JSON --content file://…`).
5. On the instance:
   `sudo install -o root -g root -m 0755 deploy/bin/descon-deploy-web /usr/local/sbin/descon-deploy-web`
   (root-owned and not writable by `deploy`).
6. GitHub → Environments: `production` (deployment branches = `main`, required
   reviewer, variable `AWS_DEPLOY_ROLE_ARN` = production role) and `preview`
   (all branches, required reviewer, `AWS_DEPLOY_ROLE_ARN` = preview role).
   Repository variables: `EC2_INSTANCE_ID`, `PUBLIC_ORIGIN`, `ARTIFACT_BUCKET`.
   Until they exist the jobs are skipped, not failed.

`deploy/test/commit_policy_test.sh` (8 checks) runs the script's own policy
function against a throwaway origin.

## 8. Verification

Run for this change (commands and output are in the pull request):

* `npm ci`, `npm run typecheck`, `npm test` (203 files, 2066 tests passed, 2
  skipped), `npm run build`, `scripts/verify-static-build.mjs` — via
  `deploy/bin/build-artifact` on a clean checkout of the branch.
* `deploy/test/commit_policy_test.sh`: 8/8 (which commits a deploy may take);
  `deploy/rehearsal/run`: 28 checks across 7 scenarios (release, second
  release, checksum mismatch leaves the live site untouched, unhealthy
  artifact restores and removes the failed release, lock contention, manual
  rollback, recovery). ShellCheck 0.11.0 clean.
* Browser check of the built SPA behind a same-origin proxy that mimics the
  production routing, against the real Rails API in production mode on local
  throwaway databases:
  * signed-out direct load of `/admin/dashboard` → client redirect to
    `/admin/login`; `/dashboard` → `/login`; an unknown path → the not-found
    screen (shell fallback);
  * sign-in → `/admin` candidates list; full reloads of `/admin/users`,
    `/admin/dashboard` (6 charts) and `/admin/backups` restore the session
    through `POST /api/v1/auth/refresh` and render;
  * `/admin/candidates/<id>` for a real candidate: 10 same-origin
    `/api/v1/admin/...` requests (candidate, fee, workflow state/transitions/
    history, QVC attempts, visa decisions, document submissions), the record's
    name and reference number rendered, no failures;
  * every API call was same-origin `/api/v1/*` (login, profile, candidates,
    countries/projects/crafts, dashboard, system_database_backups); no request
    to a mock `/api/candidates|documents|stats|timeline`, none to a
    development address, no 4xx/5xx, no console errors (only a benign
    CSS-preload warning);
  * a signed path-only `/rails/active_storage/…` URL returned by the API was
    fetched through the proxy: `200 application/gzip`, 30,342 bytes (equal to
    the recorded size), `Cache-Control: private, no-store`.

**Not verified** (needs the instance, AWS, GitHub settings or real credentials):
the deploy on the real host and under nginx 1.24; TLS issuance/renewal; the CD
path; candidate OTP sign-in (the mock SMS provider delivers nothing, so the
candidate screens past `/login` were covered by the existing component tests
only); the mobile app against this origin.
