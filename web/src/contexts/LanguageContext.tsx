import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { isRTL } from '../../../shared/i18n/locale';
import { translate } from '../../../shared/i18n/translate';
import { type Language, type TranslationKey } from '../../../shared/i18n/translations';

const STORAGE_KEY = 'descon.language';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function readPersistedLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'ur' ? 'ur' : 'en';
}

// Mounted below root.tsx's <ClientOnly> gate (via layout.jsx), so this never
// renders during SSR -- the lazy localStorage read below can't cause a
// hydration mismatch.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readPersistedLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL(language) ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);
  const toggleLanguage = useCallback(
    () => setLanguageState((prev) => (prev === 'en' ? 'ur' : 'en')),
    []
  );
  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
