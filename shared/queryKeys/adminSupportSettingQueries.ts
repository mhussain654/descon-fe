// Query key factory for the admin support-number setting singleton --
// mirrors adminAiCallOperationalSettingQueries.ts exactly. `locale` is part
// of the key so a language switch is a different cache entry, never a
// stale-locale overwrite.
import type { Language } from '../i18n/translations';

export const adminSupportSettingQueries = {
  get: (locale: Language) => ['adminSupportSetting', 'get', locale] as const,
};
