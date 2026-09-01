// Query key factory for the admin candidate creation/detail/profile-editing
// feature (MPS-F301), mirroring documentQueries.ts's/workflowQueries.ts's
// conventions -- `locale` is part of every key so a language switch is a
// different cache entry, never a stale-locale overwrite. Reference-data
// lists (countries/projects/crafts) are small, bounded lookup tables shared
// by every staff session, so they carry no candidateId dimension.
import type { Language } from '../i18n/translations';

export const adminCandidateQueries = {
  detail: (candidateId: string, locale: Language) => ['adminCandidates', 'detail', candidateId, locale] as const,
  countries: (locale: Language) => ['adminCandidates', 'countries', locale] as const,
  projects: (locale: Language) => ['adminCandidates', 'projects', locale] as const,
  crafts: (locale: Language) => ['adminCandidates', 'crafts', locale] as const,
};
