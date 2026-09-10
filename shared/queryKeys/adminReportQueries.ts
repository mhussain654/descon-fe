// Query key factory for the admin MIS report catalogue (MPS-804/805/806),
// mirroring adminAuditEventQueries.ts's conventions -- `locale` is part of
// every key so a language switch is a different cache entry, never a
// stale-locale overwrite.
import type { ReportDataParams, ReportType } from '../adminReports/types';
import type { Language } from '../i18n/translations';

export const adminReportQueries = {
  types: (locale: Language) => ['adminReports', 'types', locale] as const,
  data: (reportType: ReportType, params: ReportDataParams | undefined, locale: Language) =>
    ['adminReports', 'data', reportType, params, locale] as const,
};
