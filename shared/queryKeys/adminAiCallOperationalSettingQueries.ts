// Query key factory for the admin AI call operational settings singleton
// (MPS-F706) -- `locale` is part of the key so a language switch is a
// different cache entry, never a stale-locale overwrite.
import type { Language } from '../i18n/translations';

export const adminAiCallOperationalSettingQueries = {
  get: (locale: Language) => ['adminAiCallOperationalSettings', 'get', locale] as const,
};
