// Query key factory for the admin candidate creation/detail/profile-editing
// feature (MPS-F301), mirroring documentQueries.ts's/workflowQueries.ts's
// conventions -- `locale` is part of every key so a language switch is a
// different cache entry, never a stale-locale overwrite. Reference-data
// lists (countries/projects/crafts) are small, bounded lookup tables shared
// by every staff session, so they carry no candidateId dimension.
import type { Language } from '../i18n/translations';
import type { AdminCandidateListFilters, AdminCandidateListPage, AdminCandidateListSort } from '../adminCandidates/types';
import type { MobilizationFilters, MobilizationPage, MobilizationSort } from '../adminCandidates/mobilizations';

export const adminCandidateQueries = {
  detail: (candidateId: string, locale: Language) => ['adminCandidates', 'detail', candidateId, locale] as const,
  list: (
    filters: AdminCandidateListFilters,
    sort: AdminCandidateListSort | undefined,
    page: AdminCandidateListPage,
    locale: Language
  ) => ['adminCandidates', 'list', filters, sort, page, locale] as const,
  mobilizations: (filters: MobilizationFilters, sort: MobilizationSort | undefined, page: MobilizationPage, locale: Language) =>
    ['adminCandidates', 'mobilizations', filters, sort, page, locale] as const,
  countries: (locale: Language) => ['adminCandidates', 'countries', locale] as const,
  projects: (locale: Language) => ['adminCandidates', 'projects', locale] as const,
  crafts: (locale: Language) => ['adminCandidates', 'crafts', locale] as const,
};
