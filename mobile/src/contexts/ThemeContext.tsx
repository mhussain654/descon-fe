import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, type Theme } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { colors, getActiveScheme, setActiveScheme, type ColorScheme } from '../design-system/theme';
import { reloadApp, rememberResumeRoute } from '../lib/appRestart';

const STORAGE_KEY = 'descon.theme';

interface ThemeContextValue {
  scheme: ColorScheme;
  /** Saves the theme and reloads the app in it, reopening `resumeRoute` (e.g. "/(tabs)/profile"). */
  setScheme: (scheme: ColorScheme, resumeRoute?: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** The saved choice, else the phone's own light/dark setting. */
async function readSavedScheme(): Promise<ColorScheme> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Fall through to the phone's setting.
  }
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

function applyScheme(scheme: ColorScheme) {
  setActiveScheme(scheme);
  // Native pieces (keyboard, alerts, date pickers) follow the same theme.
  Appearance.setColorScheme?.(scheme);
  // The app's root view shows behind rounded edges (e.g. the tab bar's corners) and the Android navigation bar.
  SystemUI.setBackgroundColorAsync(scheme === 'dark' ? colors.surface.background : '#FFFFFF').catch(() => {});
}

/** React Navigation's own colours (screen and tab-bar backgrounds) for the active theme. */
function navigationTheme(scheme: ColorScheme): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  if (scheme !== 'dark') return base;
  return {
    ...base,
    colors: { ...base.colors, background: colors.surface.background, card: colors.surface.raised, border: colors.border.default, text: colors.text.primary, primary: colors.brand.default },
  };
}

/**
 * Loads the candidate's light/dark choice before anything is drawn, so every
 * screen draws in it from the start (design-system/theme.ts). Children render
 * only once it is known; the splash screen stays up until then.
 */
export function ThemeProvider({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const [scheme, setSchemeState] = useState<ColorScheme | null>(null);

  useEffect(() => {
    let cancelled = false;
    readSavedScheme().then((saved) => {
      if (cancelled) return;
      applyScheme(saved);
      setSchemeState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scheme) onReady?.();
  }, [scheme, onReady]);

  const setScheme = useCallback(async (next: ColorScheme, resumeRoute?: string) => {
    if (next === getActiveScheme()) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved: the reload below would come back in the old theme, so stay put.
      return;
    }
    if (resumeRoute) await rememberResumeRoute(resumeRoute);
    await reloadApp();
  }, []);

  if (!scheme) return null;
  return (
    <ThemeContext.Provider value={{ scheme, setScheme }}>
      <NavigationThemeProvider value={navigationTheme(scheme)}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

/** The theme in use and the way to change it. Outside ThemeProvider (isolated screen tests) the theme reads as set and cannot be changed. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? { scheme: getActiveScheme(), setScheme: async () => {} };
}
