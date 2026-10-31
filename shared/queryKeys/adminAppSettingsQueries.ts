// Query key factory for the admin App Settings feature switches -- mirrors
// adminSupportSettingQueries.ts. `locale` is part of the key so a language
// switch is a different cache entry.
import type { Language } from '../i18n/translations';

export const adminAppSettingsQueries = {
  get: (locale: Language) => ['adminAppSettings', 'get', locale] as const,
  smsTemplates: (locale: Language) => ['adminAppSettings', 'smsTemplates', locale] as const,
};
