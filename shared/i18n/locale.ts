import type { Language } from './translations';

/** BCP 47 locale used for Intl formatting per supported language. */
const INTL_LOCALES: Record<Language, string> = {
  en: 'en-PK',
  ur: 'ur-PK',
};

export function isRTL(language: Language): boolean {
  return language === 'ur';
}

export function toIntlLocale(language: Language): string {
  return INTL_LOCALES[language];
}

export function formatDate(
  date: Date | number | string,
  language: Language,
  options?: Intl.DateTimeFormatOptions
): string {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(toIntlLocale(language), {
    dateStyle: 'medium',
    ...options,
  }).format(value);
}

/**
 * The app's one short date format -- 14/11/2026 (day/month/year) -- for the
 * candidate screens, so Home, My Journey and Documents read the same.
 */
export function formatShortDate(date: Date | number | string, language: Language): string {
  const value = date instanceof Date ? date : new Date(date);
  return value.toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-GB');
}

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(toIntlLocale(language), options).format(value);
}

export function formatCurrency(
  value: number,
  language: Language,
  currency = 'PKR',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(toIntlLocale(language), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}
