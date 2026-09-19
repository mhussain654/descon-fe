// Query key factory for the MPS dashboard (MPS-802).
import type { MpsDashboardFilters, TrendGranularity } from '../adminMpsDashboard/types';
import type { Language } from '../i18n/translations';

export const adminMpsDashboardQueries = {
  summary: (granularity: TrendGranularity, locale: Language, filters: MpsDashboardFilters = {}) =>
    ['adminMpsDashboard', 'summary', granularity, locale, filters.countryCode, filters.projectCode, filters.craftCode] as const,
};
