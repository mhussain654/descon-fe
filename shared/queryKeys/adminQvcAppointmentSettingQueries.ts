// Query key factory for the admin default QVC appointment singleton --
// mirrors adminSupportSettingQueries.ts. `locale` is part of the key so a
// language switch is a different cache entry.
import type { Language } from '../i18n/translations';

export const adminQvcAppointmentSettingQueries = {
  get: (locale: Language) => ['adminQvcAppointmentSetting', 'get', locale] as const,
};
