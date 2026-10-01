// Query key factory for the admin candidate AI call history (MPS-F706),
// mirroring adminCommunicationQueries.ts's conventions -- `locale` is part
// of the key so a language switch is a different cache entry, never a
// stale-locale overwrite.
import type { Language } from '../i18n/translations';

export const adminCandidateAiCallQueries = {
  list: (candidateId: string, locale: Language) => ['adminCandidateAiCalls', 'list', candidateId, locale] as const,
};
