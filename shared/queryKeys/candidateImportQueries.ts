// Query key factory for the admin candidate CSV import wizard (MPS-F304),
// mirroring adminCandidateQueries.ts's/documentQueries.ts's conventions --
// `locale` is part of every key so a language switch is a different cache
// entry, never a stale-locale overwrite (row-error/status messages are
// localized server-side per X-Locale).
import type { CandidateImportHistoryFilters, CandidateImportHistoryPage } from '../adminCandidateImport/types';
import type { Language } from '../i18n/translations';

export const candidateImportQueries = {
  detail: (importId: string, locale: Language) => ['candidateImports', 'detail', importId, locale] as const,
  history: (filters: CandidateImportHistoryFilters, page: CandidateImportHistoryPage, locale: Language) =>
    ['candidateImports', 'history', filters, page, locale] as const,
};
