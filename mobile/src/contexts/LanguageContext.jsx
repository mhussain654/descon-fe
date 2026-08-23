import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DevSettings, I18nManager } from "react-native";
import * as Updates from "expo-updates";
import { isRTL } from "../../../shared/i18n/locale";
import { translate } from "../../../shared/i18n/translate";

const STORAGE_KEY = "descon.language";
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

  const changeLanguage = useCallback(async (next) => {
    setLanguageState(next);
    cachedLanguage = next;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best effort -- the chosen language still applies for this session
      // below; only a future cold start could lose the preference.
    }
    if (applyRTL(next)) {
      await reloadApp();
    }
  }, []);

  const setLanguage = useCallback(
    (next) => {
      changeLanguage(next);
    },
    [changeLanguage]
  );

  const toggleLanguage = useCallback(() => {
    changeLanguage(language === "en" ? "ur" : "en");
  }, [language, changeLanguage]);

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
