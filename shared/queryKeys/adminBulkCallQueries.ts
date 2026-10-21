// Query keys for the admin bulk-call page. `locale` is part of each key so a
// language switch is a separate cache entry, never a stale-locale overwrite.
import type { Language } from '../i18n/translations';
import type { BulkCallCandidatesQuery } from '../adminBulkCalls/types';

export const adminBulkCallQueries = {
  all: ['adminBulkCalls'] as const,
  voices: (locale: Language) => ['adminBulkCalls', 'voices', locale] as const,
  candidates: (locale: Language, query: BulkCallCandidatesQuery) => ['adminBulkCalls', 'candidates', locale, query] as const,
  candidatesAll: ['adminBulkCalls', 'candidates'] as const,
  batches: (locale: Language) => ['adminBulkCalls', 'batches', locale] as const,
  batch: (locale: Language, id: string) => ['adminBulkCalls', 'batch', locale, id] as const,
};
