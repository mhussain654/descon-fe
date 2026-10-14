# Descon Connect home — client review version

The public root (`/`) introduces Descon Connect and links staff to
`/admin/login`. Candidate onboarding remains in the native app.

For temporary synthetic-data testing, the old web welcome screen is at
`/candidate-preview`. Its subsequent web routes (`/login`, `/dashboard`,
`/documents`, `/status`, `/profile`) are still reachable by URL. Hiding
them from the home page is **not** access control. Do not use real candidate
information on this test host until the document scanner and other deferred
integrations are ready. Before a public production launch, remove these
candidate web routes or restrict them with an actual authorization boundary.

The Descon logo comes from the existing `web/public/descon-logo.png`.
For this review build, the hero and people images load from official
`www.descon.com/assets/` URLs. The contact address and telephone number are
from Descon's public contact page. The site copy is original draft text based
on Descon's publicly described engineering and people services; Descon should
approve the wording, images, branding and contact details. Once approved,
store approved image files locally to avoid a runtime dependency on the
corporate website.

The mobile app section says “coming soon” until official app-store links
exist. No fake download links are shown.

After review: replace the imagery with approved local assets, add actual
mobile download links, incorporate client copy feedback, and remove the
temporary web candidate routes. Admin and API routes remain unchanged.
