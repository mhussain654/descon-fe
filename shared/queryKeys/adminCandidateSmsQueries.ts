// Query key factory for the admin candidate SMS tab; `locale` is part of the
// key so a language switch never shows another language's server messages.
import type { Language } from '../i18n/translations';

export const adminCandidateSmsQueries = {
  overview: (candidateId: string, locale: Language) => ['adminCandidateSms', 'overview', candidateId, locale] as const,
};
