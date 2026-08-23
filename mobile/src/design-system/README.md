# Mobile design system (MPS-F102)

Shared visual language, states and form primitives for the candidate native
app. See `web/src/design-system/README.md` for the web equivalents -- same
semantic naming and visual intent, platform-appropriate implementation
(AGENTS.md: "Do not force React DOM and React Native to share components
when that creates brittle abstractions").

A live showcase of everything below, in both English and Urdu, is at the
`design-system` route (`mobile/src/app/design-system.jsx`).

## Tokens

`tokens.ts` re-exports the canonical values from `shared/design-tokens.ts`
directly (no build-time config to mirror them into, unlike web's Tailwind
config) plus one native-specific addition: `elevation`, mapping semantic
levels (`sm`/`md`/`lg`) to the iOS `shadow*` properties and Android's single
`elevation` number RN needs for box shadows.

Every component builds its `StyleSheet` from these tokens rather than
hardcoded hex/pixel values (AGENTS.md: "Use `StyleSheet`, shared design
tokens or the repository-approved native styling approach"). NativeWind is
not used -- Tailwind classes on mobile only apply to the `react-native-web`
build target via `tailwind.config.js`/`global.css`, not native iOS/Android.

## Components

- **Buttons**: `Button` (primary/secondary/outline/destructive/text,
  sizes, loading, icons), `IconButton` (mandatory accessible `label`, sized
  to at least `minTouchTarget` = 44px).
- **Forms**: `TextField`, `CnicField`, `OtpField`, `Label`, `HelperText`,
  `ValidationMessage`.
- **Surfaces**: `Card` (+ `CardHeader`/`CardTitle`/`CardDescription`),
  `Badge` (status, never color-only -- always paired with an icon),
  `ProgressBar`, `Timeline`, `Skeleton`.
- **States**: `LoadingState`, `EmptyState`, `ErrorState`, `RetryBanner`
  (non-blocking, for a failed background refresh with cached data still
  visible), `OfflineState`, `ForbiddenState`, `SessionExpiredState`.
- **Overlays**: `ConfirmDialog` (built on RN's `Modal`), `toast`
  (success/error/warning/info, via `sonner-native`; mount `<Toaster />` once
  near the app root -- see `src/app/_layout.jsx`).
- **Lists**: `List` -- a `FlatList` wrapper with built-in loading/empty/
  pull-to-refresh/"load more" states. This is the mobile equivalent of web's
  `DataTable` + `Pagination`; mobile favors infinite scroll over paged
  navigation, so there's no separate `Pagination` component here.
- **Search/filter**: `SearchField`, `FilterChip`.

Import from `@/design-system` (or relative paths under
`mobile/src/design-system/`).

## Localization

Every component is presentational only -- **none of them call
`useLanguage()` or own any copy**. They receive already-translated strings
as props, exactly like the web design system. Add new keys to
`shared/i18n/translations.ts` under **both** `en` and `ur` in the same
change (`shared/i18n/translations.test.ts` fails the build if the two ever
drift). Never hardcode an English or Urdu string inside a component file.

## RTL

- `LanguageContext` calls `I18nManager.allowRTL`/`forceRTL` for Urdu.
  **Layout mirroring only takes effect after the app reloads/restarts** --
  a standard React Native constraint the language context already documents,
  not something a component can work around.
- Once RTL is active, `flexDirection: 'row'` and the logical
  `marginStart`/`marginEnd`/`paddingStart`/`paddingEnd` style properties
  used throughout this design system mirror automatically. Avoid
  `marginLeft`/`marginRight`/`paddingLeft`/`paddingRight` for anything that
  should flip.
- Directional icons (chevrons, arrows) still need an explicit glyph flip --
  RTL only reorders layout, not an icon's pixels. None of this design
  system's own components use one yet; if you add one, mirror it based on
  `I18nManager.isRTL`.
- `CnicField` and `OtpField` set `textAlign: 'left'` /
  `writingDirection: 'ltr'` regardless of the app's global RTL state: a CNIC
  or OTP is a numeral, not prose, and must stay left-to-right even inside an
  Urdu screen.

## Accessibility

- Every interactive control has a real accessible name:
  `accessibilityLabel`/visible `Text` for `Button`, a mandatory `label` prop
  for `IconButton`/`SearchField`'s clear button.
- `Button`/`IconButton` report `accessibilityState={{ disabled, busy }}` for
  their disabled/loading states.
- `ErrorState`/`ForbiddenState`/`SessionExpiredState` use
  `accessibilityRole="alert"` with `accessibilityLiveRegion="assertive"` so
  they're announced as they appear.
- Status (`Badge`, `Timeline`) is always paired with an icon or explicit
  status text, never color alone.

## Testing

Every component has a colocated `*.test.tsx` (Jest + React Native Testing
Library) covering variants, disabled/loading states, accessible names/
roles, and both English and Urdu rendering. Mock the same way the rest of
the app does -- no live network, no live provider services.
