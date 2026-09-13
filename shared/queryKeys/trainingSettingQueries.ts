// Query key factory for the candidate-facing training-link setting -- not
// per-candidate content (every candidate reads the same shared link), so
// unlike workflowQueries.ts this key carries only `locale`, mirroring
// adminTrainingSettingQueries.ts's identical shape. The single shared
// QueryClient is cleared entirely on logout (see documentQueries.ts's
// comment on this), so a stale candidate's cached value can't leak into a
// different candidate's session either way.
import type { Language } from '../i18n/translations';

export const trainingSettingQueries = {
  get: (locale: Language) => ['trainingSetting', 'get', locale] as const,
};
