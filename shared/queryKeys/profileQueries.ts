// Query key factory for the candidate profile -- see documentQueries.ts for
// why `candidateId` and `locale` are both part of the key.
import type { Language } from '../i18n/translations';

export const profileQueries = {
  candidate: (candidateId: string, locale: Language) => ['profile', 'candidate', candidateId, locale] as const,
};
