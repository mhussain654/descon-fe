// Query key factory for the candidate KuickPay payment journey (MPS-F601),
// matching shared/queryKeys/documentQueries.ts's conventions: every key
// includes candidateId (never the access token) and locale.
import type { Language } from '../i18n/translations';

export const paymentQueries = {
  eligibility: (candidateId: string, locale: Language) => ['payments', 'eligibility', candidateId, locale] as const,
};
