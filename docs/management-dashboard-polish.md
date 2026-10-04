# Management dashboard polish

Management Dashboard is the first authorized dashboard link in the staff sidebar, followed by Admin Dashboard and Operations Dashboard. The formerly generic Dashboard label is now Admin Dashboard in English and Urdu. Permission checks, destinations and landing routes remain unchanged.

The Management page uses a compact gradient header, decorative section emojis, tinted KPI cards with matching label contrast, and larger conversion-step icons. A real-count conversion bar chart supplements the existing accessible step cards. The funnel/outcome row aligns cards at the top, removing the forced empty stretch. Outcome labels can wrap rather than being truncated. The existing mobilization mix and trend, granularity control, API data and loading/error/authorization behavior are preserved.

Keyboard-visible focus, reduced-motion styling on metric tiles, Urdu direction and screen-reader text remain supported; emojis are decorative. No backend change is needed.

Validation: all 204 web test files / 2,053 tests passed. After the final stage-icon refinement, all 41 focused sidebar/management tests passed again. Web typecheck and production client/server build passed. Existing sourcemap and React Router future-flag warnings remain. Live visual review is still required because the workspace browser is unavailable.
