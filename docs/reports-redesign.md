# Reports & Analytics redesign

The Reports workspace has a compact gradient header, tinted report-library cards with larger icons and a selected-state checkmark, and colored CSV, Excel and PDF export controls. Existing report selection and trend granularity controls remain supported.

Chart and Table tabs replace the long stacked chart/table layout. Tabs support keyboard arrows, Home and End. The Chart tab keeps a visually hidden data table or summary available to screen readers; charts remain supplementary. All six report types have a chart view, including craft headcount, mobilization by country/project and outcome counts.

Status summary hides zero-count stages by default in both views. Show empty stages restores every returned stage. It does not remove or change the API response, stage definitions or export parameters. Full backend exports remain available regardless of the view or checkbox. Canonical stages use the established pipeline-phase colors; other returned stages retain a neutral brand fallback. Counts appear beside report bars.

English and Urdu labels, explicit RTL direction, keyboard focus and reduced-motion support are included. Chart scrolling stays within the report card at narrow widths. Existing loading, offline, authorization, error and export-failure behavior is preserved. No backend changes or new dependencies are required.

Validation: seven focused Reports tests and web typecheck passed. Production client/server build passed with existing sourcemap and React Router future-flag warnings. All 204 web test files / 2,057 tests passed. Live responsive visual review remains pending because the workspace browser is unavailable.

Apply this incremental frontend patch after the Admin Dashboard polish patch on feat/mobile-consent-redesign.
