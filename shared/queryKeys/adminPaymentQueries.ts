// Query key factory for the admin finance payment workspace (MPS-F602),
// mirroring candidateImportQueries.ts's/adminCandidateQueries.ts's
// conventions -- `locale` is part of every key so a language switch is a
// different cache entry, never a stale-locale overwrite (candidate names
// and status labels are localized/formatted per language).
import type { PaymentListFilters, PaymentListPage, PaymentListSort } from '../adminPayments/types';
import type { Language } from '../i18n/translations';

export const adminPaymentQueries = {
  list: (filters: PaymentListFilters, sort: PaymentListSort | undefined, page: PaymentListPage, locale: Language) =>
    ['adminPayments', 'list', filters, sort, page, locale] as const,
  detail: (paymentId: string, locale: Language) => ['adminPayments', 'detail', paymentId, locale] as const,
};
