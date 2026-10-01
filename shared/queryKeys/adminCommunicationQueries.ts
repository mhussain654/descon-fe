// Query key factory for the admin communications log (MPS-F706), mirroring
// adminAuditEventQueries.ts's conventions -- `locale` is part of the key so
// a language switch is a different cache entry, never a stale-locale
// overwrite.
import type { CommunicationListFilters, CommunicationListPage, CommunicationListSort } from '../adminCommunications/types';
import type { Language } from '../i18n/translations';

export const adminCommunicationQueries = {
  list: (filters: CommunicationListFilters, sort: CommunicationListSort | undefined, page: CommunicationListPage, locale: Language) =>
    ['adminCommunications', 'list', filters, sort, page, locale] as const,
};
