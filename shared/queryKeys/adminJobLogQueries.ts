// Query key factory for the developer-only Job logs page. `locale` is part of
// the key so a language switch is a different cache entry.
import type { JobLogListFilters, JobLogListPage } from '../adminJobLogs/types';
import type { Language } from '../i18n/translations';

export const adminJobLogQueries = {
  all: ['adminJobLogs'] as const,
  list: (filters: JobLogListFilters, page: JobLogListPage, locale: Language) =>
    ['adminJobLogs', 'list', filters, page, locale] as const,
};
