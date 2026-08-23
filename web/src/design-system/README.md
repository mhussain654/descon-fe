# Web design system (MPS-F102)

Shared visual language, states and form primitives for the candidate and
admin web app. See `mobile/src/design-system/README.md` for the native
equivalents -- same semantic naming and visual intent, platform-appropriate
implementation (AGENTS.md: "Do not force React DOM and React Native to share
components when that creates brittle abstractions").

A live showcase of everything below, in both English and Urdu, is at the
`/design-system` route (`web/src/app/design-system/page.jsx`).

## Tokens

Canonical values live in `shared/design-tokens.ts` (colors, spacing, radii,
type scale, z-index, motion, breakpoints). Web mirrors the same values into
`web/tailwind.config.js` `theme.extend` -- Tailwind's config loader runs in
plain Node and can't import that TypeScript module directly, so the two are
kept in sync manually (small, infrequent edits). CSS variables for the
shadcn/ui convention (`--primary`, `--destructive`, `--radius`, ...) live in
`web/src/app/global.css`.

Use the Tailwind classes (`bg-brand`, `text-danger-emphasis`,
`bg-surface-sunken`, `border-border`, `rounded-xl`, `z-modal`, ...) rather
than hardcoding hex values or arbitrary Tailwind values -- arbitrary
class names can't be discovered by the production build (AGENTS.md).

Font sizes, spacing and elevation reuse Tailwind's own default scale
(already 4px-based and consistent with `shared/design-tokens.ts`) rather than
introducing a parallel, redundant scale.

## Reused infrastructure

`@lshay/ui` (a published build of shadcn/ui, already an installed
dependency from the app template) provides the accessible primitives behind
`Table` and the CSS-variable theming convention. `Dialog` is built directly
on `@radix-ui/react-dialog` instead of `@lshay/ui`'s `DialogContent` wrapper,
because that wrapper bakes in a hardcoded English "Close" accessible label --
not acceptable for an English/Urdu product. `OtpField` uses `input-otp` for
correct autofill/paste-across-boxes behavior. Toasts reuse `sonner`, already
mounted globally in `src/app/root.tsx`.

## Components

- **Buttons**: `Button` (primary/secondary/outline/destructive/text,
  sizes, loading, icons), `IconButton` (mandatory accessible `label`).
- **Forms**: `Input`, `CnicField`, `OtpField`, `Label`, `HelperText`,
  `ValidationMessage`.
- **Surfaces**: `Card` (+ `CardHeader`/`CardTitle`/`CardDescription`),
  `Badge` (status, never color-only -- always paired with an icon),
  `ProgressBar`, `Timeline`, `Skeleton`.
- **States**: `LoadingState`, `EmptyState`, `ErrorState`, `RetryBanner`
  (non-blocking, for a failed background refresh with cached data still
  visible), `OfflineState`, `ForbiddenState`, `SessionExpiredState`.
- **Overlays**: `Dialog`/`DialogContent`/`DialogFooter`/`ConfirmDialog`,
  `toast` (success/error/warning/info).
- **Data**: `DataTable` (+ raw `TableRoot`/`TableHeader`/... for custom
  layouts), `Pagination`, `SearchField`, `FilterChip`.

Import from `@/design-system` (or relative paths under
`web/src/design-system/`).

## Localization

Every component is presentational only -- **none of them call
`useLanguage()` or own any copy**. They receive already-translated strings
(or translation-derived values like `formatNumber` output) as props. This
keeps the design system portable and testable without a `LanguageProvider`,
and keeps translation ownership with the feature code that knows which key
applies.

When wiring a component into a screen:

```tsx
const { t } = useLanguage();
<Button variant="primary">{t('continue')}</Button>
<ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={refetch} />
```

Add new keys to `shared/i18n/translations.ts` under **both** `en` and `ur` in
the same change (`shared/i18n/translations.test.ts` fails the build if the
two ever drift). Never hardcode an English or Urdu string inside a component
file.

## RTL

- `LanguageContext` sets `document.documentElement.dir`/`lang` and toggles a
  `font-noto-nastaliq-urdu` class for Urdu (better long-form legibility than
  the default Latin face). Components don't need to do anything for layout
  mirroring beyond using Tailwind's logical-property utilities
  (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`/`start-*`/`end-*`)
  instead of physical ones (`ml-*`/`pl-*`/`text-left`/`left-*`) -- flexbox
  `flex-direction: row` already reorders automatically under `dir="rtl"`.
- **Directional icons need an explicit flip.** Position mirrors for free;
  the icon's glyph does not. See `Pagination`'s chevrons
  (`className="... rtl:rotate-180"`) for the pattern -- apply it to any
  other left/right-pointing icon you add.
- `CnicField` and `OtpField` force `dir="ltr"` on their `<input>` regardless
  of the surrounding layout direction: a CNIC or OTP is a numeral, not
  prose, and must stay left-to-right even inside an Urdu screen.

## Accessibility

- Every interactive control has a real accessible name: visible text for
  `Button`, a mandatory `label` prop for `IconButton`/`SearchField`'s clear
  button.
- Focus is visible everywhere via `focus-visible:ring-2 focus-visible:ring-ring`.
- `ValidationMessage`/`ErrorState`/`ForbiddenState`/`SessionExpiredState` use
  `role="alert"` so assistive tech announces them as they appear.
- Status (`Badge`, `Timeline`) is always paired with an icon or explicit
  status text, never color alone.

## Testing

Every component has a colocated `*.test.tsx` (Vitest + Testing Library)
covering variants, disabled/loading states, keyboard interaction,
accessible names/roles, and both English and Urdu rendering (including that
long Urdu text doesn't get `truncate`d/clipped). Mock the same way the rest
of the app does -- no live network, no live provider services.
