import { type Language, type TranslationKey, translations } from './translations';

// React Native/Metro define this global at build time; it doesn't exist in a
// plain web/Node runtime, where `typeof` on an undeclared identifier is the
// one reference form that's always safe (never throws).
declare const __DEV__: boolean | undefined;

const warnedKeys = new Set<string>();

/**
 * Looks up `key` for `language`, warning once per missing key in dev so a
 * typo'd or newly-added key doesn't silently render as raw text in
 * production. `__DEV__` covers React Native; `process.env.NODE_ENV` covers
 * web/Node.
 */
export function translate(language: Language, key: TranslationKey): string {
  const value = translations[language][key];
  if (value === undefined) {
    const devFlag =
      (typeof __DEV__ !== 'undefined' && __DEV__) ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
    const warnKey = `${language}:${key}`;
    if (devFlag && !warnedKeys.has(warnKey)) {
      warnedKeys.add(warnKey);
      // eslint-disable-next-line no-console
      console.warn(`[i18n] Missing translation for key "${key}" in locale "${language}"`);
    }
    return key;
  }
  return value;
}
