// Query key factory for the admin default flight details singleton --
// mirrors adminSupportSettingQueries.ts. `locale` is part of the key so a
// language switch is a different cache entry.
import type { Language } from '../i18n/translations';

export const adminFlightDetailSettingQueries = {
  get: (locale: Language) => ['adminFlightDetailSetting', 'get', locale] as const,
};
