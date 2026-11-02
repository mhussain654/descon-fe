import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DevSettings, I18nManager } from "react-native";
import * as Updates from "expo-updates";
import { isRTL } from "../../../shared/i18n/locale";
import { translate } from "../../../shared/i18n/translate";

const STORAGE_KEY = "descon.language";
// The screen to reopen after the reload a direction change needs -- otherwise
// the restarted app opens on its first screen (the language page for a guest).
const RESUME_ROUTE_KEY = "descon.languageResumeRoute";
// Only screens that switch language themselves; anything else is ignored.
const RESUMABLE_ROUTES = new Set(["/login", "/consent", "/(tabs)/profile"]);

/** The screen a language switch asked to return to (once): read and cleared on startup. */
export async function takeLanguageResumeRoute() {
  try {
    const route = await AsyncStorage.getItem(RESUME_ROUTE_KEY);
    if (route !== null) await AsyncStorage.removeItem(RESUME_ROUTE_KEY);
    return RESUMABLE_ROUTES.has(route) ? route : null;
  } catch {
    return null;
  }
}
const LanguageContext = createContext();

// Mirrors the provider's language outside React, synchronously, for the
// crash boundaries that must render above (and independently of) this
// provider -- they can't safely depend on context that the crash itself
// might have come from.
let cachedLanguage = "en";
export function getCachedLanguage() {
  return cachedLanguage;
}

async function readPersistedLanguage() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored === "ur" ? "ur" : "en";
  } catch {
    return "en";
  }
}

/**
 * `I18nManager.forceRTL()` only takes effect after the JS bundle reloads --
 * a standard React Native constraint. Reloading here, right after the new
 * language is persisted, means a candidate who picks Urdu on the welcome
 * screen and continues to login sees the correct direction immediately
 * instead of a mismatched LTR layout until their next restart.
 */
async function reloadApp() {
  if (__DEV__) {
    try {
      DevSettings.reload();
    } catch {
      // No dev host attached to reload against (e.g. this test environment).
    }
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // No update channel configured for this runtime (e.g. a bare Expo Go
    // session) -- direction still applies correctly on the next natural
    // restart, which is the same behavior this fix is improving on.
  }
}

function applyRTL(language) {
  const rtl = isRTL(language);
  const changed = I18nManager.isRTL !== rtl;
  if (changed) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
  return changed;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    let cancelled = false;
    readPersistedLanguage().then((stored) => {
      if (cancelled) return;
      setLanguageState(stored);
      cachedLanguage = stored;
      // A fresh app process reloading itself as its very first act would
      // loop forever, so startup only ever applies direction, never reloads
      // -- it's already correct by the time anything renders.
      applyRTL(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const changeLanguage = useCallback(async (next, resumeRoute) => {
    setLanguageState(next);
    cachedLanguage = next;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best effort -- the chosen language still applies for this session
      // below; only a future cold start could lose the preference.
    }
    if (applyRTL(next)) {
      if (resumeRoute) {
        try {
          await AsyncStorage.setItem(RESUME_ROUTE_KEY, resumeRoute);
        } catch {
          // The restarted app then opens on its first screen, as before.
        }
      }
      await reloadApp();
    }
  }, []);

  const setLanguage = useCallback(
    (next, resumeRoute) => {
      changeLanguage(next, resumeRoute);
    },
    [changeLanguage]
  );

  /** `resumeRoute`: the screen to come back to after the reload, e.g. "/login". */
  const toggleLanguage = useCallback(
    (resumeRoute) => {
      changeLanguage(language === "en" ? "ur" : "en", typeof resumeRoute === "string" ? resumeRoute : undefined);
    },
    [language, changeLanguage]
  );

  const t = useCallback((key) => translate(language, key), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
