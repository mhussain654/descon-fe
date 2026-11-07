// The mobile app's light and dark themes. Every colour a screen draws is read
// from here when the screen draws -- never captured when a file loads -- so
// the theme chosen in Profile (ThemeContext) applies everywhere:
//
// - `colors` returns the active theme's value for each token.
// - `themed(light, dark)` picks between two literal colours, for the few
//   artwork-specific colours that have no token.
// - `themedStyles(() => ({ ... }))` replaces a module-level
//   `StyleSheet.create({ ... })`: the styles are built on first use, once per
//   theme, so the colours inside them belong to the active theme.
// - `themedValues(() => ({ ... }))` does the same for a module-level object
//   of colours, such as the tones of each status.
//
// Switching theme saves the choice and reloads the app (ThemeContext), so a
// theme is fixed for the whole life of a running app.
import { StyleSheet } from 'react-native';
import { colors as lightColors } from '../../../shared/design-tokens';

export type ColorScheme = 'light' | 'dark';

type Palette = { [Group in keyof typeof lightColors]: { [Token in keyof (typeof lightColors)[Group]]: string } };

/**
 * Dark palette: the admin web's dark theme (web/src/app/global.css `.dark`)
 * for text, surfaces and borders; the semantic colours lifted so they still
 * read on a dark surface. `text.inverse` and each `on` stay white: they are
 * the words drawn on a coloured header or button in both themes.
 */
const darkColors: Palette = {
  brand: { subtle: '#12263D', default: '#3B95E0', emphasis: '#7AB8F0', on: '#FFFFFF' },
  success: { subtle: '#0F2E23', default: '#10B981', emphasis: '#34D399', on: '#FFFFFF' },
  warning: { subtle: '#33260C', default: '#F59E0B', emphasis: '#FBBF24', on: '#1A1A1A' },
  danger: { subtle: '#3A1717', default: '#EF4444', emphasis: '#F87171', on: '#FFFFFF' },
  info: { subtle: '#0C2A3D', default: '#0EA5E9', emphasis: '#38BDF8', on: '#FFFFFF' },
  text: { primary: '#F1F5F9', secondary: '#94A3B8', tertiary: '#7C8BA1', disabled: '#475569', inverse: '#FFFFFF' },
  surface: { background: '#0F172A', raised: '#1E293B', sunken: '#172235', overlay: 'rgba(0, 0, 0, 0.6)' },
  border: { default: '#334155', strong: '#475569', focus: '#3B95E0' },
};

const palettes: Record<ColorScheme, Palette> = { light: lightColors, dark: darkColors };

let activeScheme: ColorScheme = 'light';

/** The theme every screen draws with. Set once at startup, before anything renders (ThemeContext). */
export function getActiveScheme(): ColorScheme {
  return activeScheme;
}

export function setActiveScheme(scheme: ColorScheme): void {
  activeScheme = scheme;
}

export const isDarkTheme = (): boolean => activeScheme === 'dark';

/** The active theme's colour tokens, same names as shared/design-tokens.ts. */
export const colors = {} as typeof lightColors;
(Object.keys(lightColors) as (keyof typeof lightColors)[]).forEach((group) => {
  Object.defineProperty(colors, group, { enumerable: true, get: () => palettes[activeScheme][group] });
});

/** One of two literal colours for the active theme, for artwork colours with no token. */
export function themed(light: string, dark: string): string {
  return activeScheme === 'dark' ? dark : light;
}

/** A module-level stylesheet whose colours follow the active theme (built on first use, once per theme). */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(build: () => T): T {
  const built: Partial<Record<ColorScheme, T>> = {};
  const current = () => (built[activeScheme] ??= StyleSheet.create(build()));
  return new Proxy({} as T, {
    get: (_, key) => current()[key as keyof T],
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => ({ ...Reflect.getOwnPropertyDescriptor(current(), key), configurable: true }),
  });
}

/** A module-level object of colours (e.g. tones per status) built for the active theme on first use. */
export function themedValues<T extends object>(build: () => T): T {
  const built: Partial<Record<ColorScheme, T>> = {};
  const current = () => (built[activeScheme] ??= build());
  return new Proxy({} as T, {
    get: (_, key) => current()[key as keyof T],
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => ({ ...Reflect.getOwnPropertyDescriptor(current(), key), configurable: true }),
  });
}
