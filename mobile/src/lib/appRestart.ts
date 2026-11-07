import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings } from 'react-native';
import * as Updates from 'expo-updates';

// Restarting the app for a setting that only applies after a reload (the
// writing direction of a language, the colour theme), and reopening the screen
// that asked for it instead of the first screen. The key keeps its original
// name so a restart requested by an older build is still honoured.
const RESUME_ROUTE_KEY = 'descon.languageResumeRoute';
// Only screens that change these settings themselves; anything else is ignored.
const RESUMABLE_ROUTES = new Set(['/login', '/consent', '/(tabs)/profile']);

/** Remembers the screen to reopen after the next restart. */
export async function rememberResumeRoute(route: string): Promise<void> {
  try {
    await AsyncStorage.setItem(RESUME_ROUTE_KEY, route);
  } catch {
    // The restarted app then opens on its first screen, as before.
  }
}

/** The screen a restart asked to return to (once): read and cleared on startup. */
export async function takeResumeRoute(): Promise<string | null> {
  try {
    const route = await AsyncStorage.getItem(RESUME_ROUTE_KEY);
    if (route !== null) await AsyncStorage.removeItem(RESUME_ROUTE_KEY);
    return route !== null && RESUMABLE_ROUTES.has(route) ? route : null;
  } catch {
    return null;
  }
}

/** Reloads the JS bundle: the dev host's reload in development, expo-updates in a release build. */
export async function reloadApp(): Promise<void> {
  if (__DEV__) {
    try {
      DevSettings.reload();
    } catch {
      // No dev host attached to reload against (e.g. a test environment).
    }
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // No update channel configured for this runtime (e.g. Expo Go) -- the
    // setting still applies on the next natural restart.
  }
}
