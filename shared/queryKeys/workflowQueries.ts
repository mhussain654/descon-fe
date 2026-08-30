// Query key factory for the candidate workflow history -- see
// documentQueries.ts for why `candidateId` and `locale` are both part of
// the key.
import type { Language } from '../i18n/translations';

export const workflowQueries = {
  history: (candidateId: string, locale: Language) => ['workflow', 'history', candidateId, locale] as const,
};
