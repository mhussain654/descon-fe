// Query key factory for the admin audit explorer (MPS-F803), mirroring
// adminPaymentQueries.ts's conventions -- `locale` is part of the key so a
// language switch is a different cache entry, never a stale-locale
// overwrite.
import type { AuditEventListFilters, AuditEventListPage, AuditEventListSort } from '../adminAuditEvents/types';
import type { Language } from '../i18n/translations';

export const adminAuditEventQueries = {
  list: (filters: AuditEventListFilters, sort: AuditEventListSort | undefined, page: AuditEventListPage, locale: Language) =>
    ['adminAuditEvents', 'list', filters, sort, page, locale] as const,
};
