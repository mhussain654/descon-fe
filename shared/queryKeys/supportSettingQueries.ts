// Query key factory for the candidate-facing support number -- shared, not
// per-candidate content, so (like trainingSettingQueries.ts) it carries only
// `locale`. The QueryClient is cleared entirely on logout.
import type { Language } from '../i18n/translations';

export const supportSettingQueries = {
  get: (locale: Language) => ['supportSetting', 'get', locale] as const,
};
