# Admin Dashboard redesign

The daily admin overview now uses the Admin Dashboard title, a compact blue gradient header, decorative section emojis and tinted KPI cards. Requires attention sits above the pipeline in a responsive four-item grid. Existing permission checks, insight calculations, filters, API requests and recovery states remain unchanged.

Pipeline phases retain the existing five-phase grouping and exact counts. Each phase can be expanded with mouse or keyboard to reveal the actual returned workflow stages. Stage links open the candidate list with its supported single-stage status filter and preserve country, project and craft filters. The bars compare phase sizes; they are not completion percentages. The all-stages report link remains available.

Document and payment charts sit above compact status tiles. Upcoming activities use a separate, naturally sized schedule section rather than stretching to match the chart cards. Dates and reference numbers wrap at narrow widths. Recent candidate next-action hints link to the candidate profile; mobilized candidates retain the plain no-action-needed hint.

English and Urdu content are preserved, Urdu direction is explicit, decorative emojis are hidden from screen readers, expandable phases use native details controls, and new stage/action links have visible keyboard focus. Animated KPI tiles respect reduced motion. No backend changes or dependencies are required.

Validation: 16 focused dashboard tests and web typecheck passed. Production client/server build passed with existing sourcemap and React Router future-flag warnings. All 204 web test files / 2,055 tests passed. Live responsive visual review remains pending because the workspace browser is unavailable.

Apply the incremental frontend patch after the Management Dashboard polish patch on feat/mobile-consent-redesign.
