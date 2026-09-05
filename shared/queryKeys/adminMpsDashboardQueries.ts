// Query key factory for the MPS dashboard (MPS-802).
import type { TrendGranularity } from '../adminMpsDashboard/types';
import type { Language } from '../i18n/translations';

export const adminMpsDashboardQueries = {
  summary: (granularity: TrendGranularity, locale: Language) => ['adminMpsDashboard', 'summary', granularity, locale] as const,
};
