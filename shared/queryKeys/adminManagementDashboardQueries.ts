// Query key factory for the Management dashboard (MPS-803).
import type { TrendGranularity } from '../adminManagementDashboard/types';
import type { Language } from '../i18n/translations';

export const adminManagementDashboardQueries = {
  summary: (granularity: TrendGranularity, locale: Language) => ['adminManagementDashboard', 'summary', granularity, locale] as const,
};
