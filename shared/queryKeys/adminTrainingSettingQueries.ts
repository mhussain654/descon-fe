// Query key factory for the admin training-link setting singleton --
// mirrors adminAiCallOperationalSettingQueries.ts exactly. `locale` is part
// of the key so a language switch is a different cache entry, never a
// stale-locale overwrite.
import type { Language } from '../i18n/translations';

export const adminTrainingSettingQueries = {
  get: (locale: Language) => ['adminTrainingSetting', 'get', locale] as const,
};
