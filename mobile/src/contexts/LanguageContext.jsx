import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { I18nManager } from "react-native";
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

function applyRTL(language) {
  const rtl = isRTL(language);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    // Layout direction only takes effect after the next app reload/restart --
    // a standard React Native constraint, not something this hook can avoid.
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    let cancelled = false;
    readPersistedLanguage().then((stored) => {
      if (cancelled) return;
      setLanguageState(stored);
      cachedLanguage = stored;
      applyRTL(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((next) => {
    setLanguageState(next);
    cachedLanguage = next;
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    applyRTL(next);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next = prev === "en" ? "ur" : "en";
      cachedLanguage = next;
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      applyRTL(next);
      return next;
    });
  }, []);

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
