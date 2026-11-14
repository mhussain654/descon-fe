// Query key factory for a candidate's developer-only correction boxes (Overview tab).
import type { Language } from '../i18n/translations';

export const adminWorkflowCorrectionQueries = {
  get: (candidateId: string, locale: Language) => ['adminWorkflowCorrections', candidateId, locale] as const,
};
