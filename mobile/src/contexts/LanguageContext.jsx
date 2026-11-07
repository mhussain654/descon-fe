import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { I18nManager } from "react-native";
import { isRTL } from "../../../shared/i18n/locale";
import { translate } from "../../../shared/i18n/translate";
import { reloadApp, rememberResumeRoute, takeResumeRoute } from "../lib/appRestart";

const STORAGE_KEY = "descon.language";

/** The screen a language switch asked to return to (once): read and cleared on startup. */
export const takeLanguageResumeRoute = takeResumeRoute;
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

// `I18nManager.forceRTL()` only takes effect after the JS bundle reloads -- a
// standard React Native constraint -- so a change of direction reloads the
// app right after the new language is saved (lib/appRestart.ts).

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
      if (resumeRoute) await rememberResumeRoute(resumeRoute);
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
