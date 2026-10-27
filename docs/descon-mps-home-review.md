# Descon Manpower Service home — client review version

The public root (`/`) introduces **Descon Manpower Service (Descon MPS)** and
links staff to `/admin/login`. **MPS Connect** is the name of the candidate
mobile app only. Candidate onboarding belongs in that native app.

## Temporary web candidate flow and removal

For synthetic-data testing, the former web welcome screen is at
`/candidate-preview`. The candidate web routes `/login`, `/dashboard`,
`/documents`, `/status`, `/profile`, `/consent`, `/payment`, and
`/payment/pending` may still be opened directly. A hidden link is not access
control. Do not put real candidate information on this test host while the
scanner and other deferred integrations remain incomplete.

Remove the candidate-facing web implementation in a separate follow-up PR
after the review and testing period:

1. Remove `/candidate-preview` and all candidate-only web routes listed above
   from the route tree, along with their page tests. Check for additional
   candidate routes before deleting. Keep `/`, `/admin/*`, and any routes
   needed by the staff portal.
2. Trace imports from the remaining web pages. Delete candidate-only web
   components, contexts, hooks, clients, styles, and assets that are no longer
   referenced. Keep `mobile/` and portable `shared/` code used by mobile or
   staff; do not remove backend endpoints used by the mobile app.
3. Review payment redirects and API callbacks with the backend team before
   removing a URL an external provider may call. Do not imply that the
   candidate web payment screen is a working payment flow.
4. Run web typecheck, tests, and build. Confirm `/` and `/admin/login` work,
   candidate URLs no longer render onboarding screens, the deployed web build
   has no candidate UI routes, and mobile onboarding still works independently.

This is a planned removal, not part of the present home-page PR. The existing
candidate routes remain reachable until that PR is deployed; review access
accordingly.

## Client review items

The Descon logo comes from the existing `web/public/descon-logo.png`. For this
review build, the hero and people images load from official
`www.descon.com/assets/` URLs. The contact address and telephone number come
from Descon's public contact page. Descon should approve the draft wording,
images, branding, and contact details. Store approved image files locally to
avoid a runtime dependency on the corporate website.

The MPS Connect mobile app section says “coming soon” until official app
store links exist. No fake download links are shown. After review, replace
the imagery, add real mobile download links, and incorporate client feedback.
