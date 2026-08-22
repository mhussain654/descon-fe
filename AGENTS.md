# Descon Frontend Engineering Instructions

## Scope and precedence

These instructions apply to the entire `descon-fe` repository, including:

- `web`: browser application for candidate and authorized web users
- `mobile`: Expo/React Native application for native candidate experiences

Follow the requirements and acceptance criteria of the active ticket together
with this file. If a ticket conflicts with these instructions, stop and request
a clear product or technical decision before implementing it.

The approved prototype is a visual and flow baseline, not production-ready
behavior. Preserve its approved design direction while replacing mock behavior
with secure, accessible, maintainable and well-tested implementation.

## Working rules

- Read the active Trello ticket and related API contract before changing code.
- Keep each change limited to one ticket unless an approved dependency requires
  a small related change.
- Inspect existing patterns before introducing a library, abstraction or folder.
- Preserve unrelated user changes in the working tree.
- Do not commit credentials, real `.env` files, production tokens or personal
  candidate data.
- Do not leave debugging statements, temporary screens, commented-out code,
  unexplained TODOs or unused imports.
- Update tests and documentation in the same PR as behavior changes.
- Do not change an approved flow or design merely to simplify implementation.

## Web and mobile alignment

Web and mobile candidate experiences must share the same:

- Business workflow and stage definitions
- Field requirements and validation rules
- API contracts and response interpretation
- Authentication and session behavior
- Status names and user-facing meaning
- English and Urdu translation keys
- Loading, empty, error, offline and retry scenarios
- Design language, colors, spacing, typography and interaction intent
- Security and privacy behavior

Platform-specific UI implementations are allowed and expected. Do not force
React DOM and React Native to share components when that creates brittle
abstractions. Share contracts, types, schemas, constants, tokens and pure logic
when they are genuinely platform-independent.

Unless explicitly required by the product scope, administrative workflows remain
web-focused. Candidate workflows should remain consistent between web and native
mobile.

## Architecture and maintainability

- Use TypeScript for all new application code. Migrate touched JavaScript files
  when doing so is safe and within ticket scope.
- Organize code by clear feature or domain ownership rather than generic dumping
  grounds.
- Keep route/page components focused on composition and route-level concerns.
- Move reusable UI behavior into well-named components and hooks.
- Keep server/API state in TanStack Query or the approved data layer.
- Do not duplicate remote data in unnecessary global stores.
- Use global state only for genuinely cross-cutting client state.
- Keep business rules out of visual components.
- Use pure functions for portable formatting, mapping and validation logic.
- Avoid generic `utils`, `helpers`, `common` or `misc` files. Name modules after
  their responsibility.
- Avoid unnecessary wrapper components, hooks, context providers and middleware.
  Every abstraction must reduce real complexity or duplication.
- Do not duplicate API calls, status definitions, route strings or validation
  logic across screens.
- Prefer composition over large components with many boolean configuration props.
- Delete obsolete code only after confirming that no approved prototype route or
  flow depends on it.

## API integration

- The Rails OpenAPI document is the API contract and source of truth.
- Do not invent endpoint paths, request fields, response fields or status values.
- Use a centralized, configured API client for web and mobile.
- Keep environment-specific base URLs out of source code.
- Use `VITE_API_BASE_URL` for web configuration.
- Use `EXPO_PUBLIC_API_BASE_URL` for mobile configuration.
- Generate or derive TypeScript API types from OpenAPI when practical.
- Do not manually duplicate backend response types in multiple features.
- Normalize API errors through one documented error model.
- Handle validation, authentication, authorization, rate-limit, server and
  network failures explicitly.
- Cancel or ignore stale requests where navigation or changing filters can cause
  races.
- Do not retry non-idempotent mutations automatically unless explicitly safe.
- Do not hide contract mismatches with permissive `any` types or silent fallback
  values.
- Mock data must be isolated behind the same interface used by real APIs and
  removed when the relevant feature integration is complete.
- Never silently fall back to mock data in production.

## Web application standards

- Use semantic HTML and accessible controls.
- Use Tailwind utility classes and the approved component system consistently.
- Do not add arbitrary inline `style` objects for normal styling.
- Use shared design tokens or Tailwind configuration for colors, spacing,
  typography, breakpoints and elevation.
- Avoid arbitrary values when an existing token expresses the design.
- Do not construct dynamic Tailwind class names that production builds cannot
  discover.
- Use responsive layouts that work from supported mobile widths through tablet
  and desktop sizes.
- Ensure content remains usable at zoom and with longer Urdu labels.
- Provide keyboard access, visible focus states and logical focus order.
- Use buttons for actions and links for navigation.
- Associate labels, errors and instructions with form fields.
- Avoid unnecessary client-side JavaScript and heavy dependencies.
- Lazy-load large routes or libraries when it materially reduces initial work.
- Avoid layout shift and unnecessary re-renders.

## Mobile application standards

- Follow Expo and React Native conventions.
- Use platform-appropriate navigation, gestures, safe areas and keyboard handling.
- Do not place large anonymous style objects inside render functions.
- Use `StyleSheet`, shared design tokens or the repository-approved native styling
  approach.
- Tailwind web classes are not automatically a React Native styling standard.
  Do not introduce NativeWind or another styling framework without approval.
- Use `expo-secure-store` or another approved secure native store for sensitive
  tokens. Do not store access or refresh tokens in AsyncStorage.
- Support practical phone sizes and orientations defined by the ticket.
- Test layouts with font scaling and longer Urdu content.
- Handle app backgrounding, resumed sessions, network changes and expired tokens.
- Keep native permissions minimal and request them only when needed.
- Explain the purpose of camera, file, notification or other permissions before
  requesting them where appropriate.
- Avoid unnecessary native dependencies that increase build size and risk.

## Responsive design

- Every web feature must be verified at representative phone, tablet and desktop
  widths.
- Every mobile feature must be verified on representative small and large phones.
- No horizontal page overflow, clipped text, overlapping controls or inaccessible
  actions are acceptable.
- Tables must provide a usable small-screen strategy, such as responsive columns,
  cards or controlled scrolling.
- Modals and drawers must fit within the viewport and remain keyboard accessible.
- Urdu and English must both work without layout breakage.
- Do not encode important meaning using color alone.

## Localization

- Support English (`en`) and Urdu (`ur`) throughout web and mobile.
- Do not hardcode user-facing strings inside feature components.
- Add both English and Urdu values for every new translation key.
- Use shared translation-key naming across platforms.
- Support right-to-left layout for Urdu where required by the approved design.
- Use locale-aware formatting for dates, numbers and currency.
- Do not translate identifiers, reference numbers or backend enum values directly.
  Map them to localized presentation labels.
- Test long translations, missing translations and language switching.

## Forms and validation

- Use one clear schema-driven validation approach per platform/application.
- Keep frontend rules synchronized with the OpenAPI/backend contract.
- Frontend validation improves UX but never replaces backend validation.
- Normalize CNIC and phone input consistently.
- Display actionable field-level errors and an appropriate form-level summary.
- Preserve user input after recoverable failures.
- Disable repeated submissions while a request is in progress.
- Prevent accidental duplicate mutations.
- Make required, optional and read-only fields visually and semantically clear.

## Loading, empty, error and offline states

- Every remote-data view must define loading, success, empty and error states.
- Mobile features that require connectivity must define offline behavior.
- Do not show infinite spinners without an error or retry path.
- Use skeletons only when they improve perceived performance and match the final
  layout.
- Error messages must be safe, localized and useful without exposing internal
  details.
- Preserve usable cached data when a background refresh fails.
- Make retry behavior explicit and safe.

## Frontend security

- Treat all backend, URL, storage and user-provided data as untrusted.
- Never render unsanitized HTML.
- Do not expose secrets through `VITE_*`, `EXPO_PUBLIC_*` or bundled source.
- Do not log tokens, OTPs, complete CNICs, passport numbers, bank details,
  documents or sensitive API payloads.
- Mask sensitive identifiers where full values are not required.
- Do not put access or refresh tokens in URLs.
- Prefer secure, httpOnly cookie sessions for web when supported by the agreed
  architecture. If bearer tokens are required, follow the approved storage plan.
- Store native sensitive tokens only in secure storage.
- Clear sensitive state and caches on logout.
- Enforce authorization on the backend; frontend route guards are UX controls,
  not a security boundary.
- Avoid open redirects and validate external navigation targets.
- Restrict file selection by documented type and size, while relying on backend
  validation as the final authority.
- Do not expose private file URLs longer than necessary.
- Keep dependencies current and review advisories before adding packages.
- Add security headers and CSP through the web deployment/server layer where
  supported.

## Performance

- Measure before adding performance abstractions.
- Avoid unnecessary component re-renders and duplicated requests.
- Use stable query keys and appropriate cache/stale policies.
- Paginate or virtualize large collections.
- Debounce search input where appropriate and cancel stale searches.
- Optimize images and avoid shipping original-size assets unnecessarily.
- Lazy-load large libraries, routes and document viewers when useful.
- Do not add a large dependency for a small utility.
- Monitor web bundle size and mobile dependency/build impact.
- Avoid expensive calculations during render; memoize only when justified.
- Keep candidate dashboard and authentication startup paths lightweight.

## Accessibility

- Meet WCAG 2.1 AA expectations for web interfaces.
- Provide accessible names for interactive controls and icons.
- Maintain sufficient color contrast.
- Support keyboard navigation and visible focus on web.
- Announce validation errors, async outcomes and important status changes.
- Provide touch targets of an appropriate size on mobile.
- Respect reduced-motion and font-scaling preferences where supported.
- Ensure status and progress information is understandable without color.

## Testing standards

- Every behavior change requires meaningful automated tests at the appropriate
  level.
- Test user-observable behavior rather than component internals.
- Web: use Vitest and Testing Library for components and feature behavior.
- Mobile: use Jest and React Native Testing Library for components and flows.
- Test success, validation errors, authorization failures, API failures, empty
  states and relevant offline/retry behavior.
- Test English and Urdu for features whose layout or content changes by locale.
- Mock the centralized API boundary, not global implementation details scattered
  across tests.
- Keep tests deterministic and independent of execution order.
- Avoid excessive snapshots; use assertions that describe important behavior.
- Add end-to-end coverage for critical flows as the project harness is introduced.
- Do not call live backend or provider services from unit/component tests.

## Code quality

- TypeScript, ESLint and formatting checks must pass.
- Avoid `any`; use `unknown` and narrow it when external data is not yet typed.
- Do not suppress TypeScript or lint errors without a documented reason.
- Keep components and functions cohesive and reasonably small.
- Use clear domain names instead of vague abbreviations.
- Avoid deeply nested conditionals and excessive boolean props.
- Prefer early returns when they make state handling clearer.
- Do not use index keys for mutable lists.
- Clean up effects, subscriptions, timers and listeners.
- Keep effect dependencies correct; do not suppress dependency rules casually.
- Remove unused dependencies only after confirming all web/mobile usages.

## Required verification

Run the relevant application checks during development and all available checks
before opening a PR.

Web minimum:

```bash
cd web
npm ci
npm run typecheck
npm test --if-present
npm run build
```

Mobile minimum:

```bash
cd mobile
npm ci
npm test -- --runInBand
```

Also run from the repository root:

```bash
git diff --check
```

When lint and formatting scripts are added, they become mandatory CI and local
verification steps. Do not bypass a failing check to merge a PR.

## Definition of done

A frontend ticket is complete only when:

- Every acceptance criterion is implemented.
- The implementation matches the approved UI and API contract.
- Web and mobile behavior remain aligned where the feature exists on both.
- Loading, empty, error, offline and retry states are handled as applicable.
- English and Urdu are implemented and verified.
- Responsive behavior is verified on representative device sizes.
- Accessibility, security and sensitive-data handling have been reviewed.
- API types and mocks are synchronized with OpenAPI.
- Automated tests cover meaningful success and failure behavior.
- Type checking, tests, builds, linting and formatting checks pass.
- No secrets, debug code, unrelated refactors or unexplained TODOs are included.
- The PR includes test evidence, screenshots/recordings, API dependencies and any
  known platform differences.
