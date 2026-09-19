// Query key factory for the Admin dashboard (MPS-801).
import type { Language } from '../i18n/translations';
import type { AdminDashboardFilters } from '../adminDashboard/types';

export const adminDashboardQueries = {
  summary: (locale: Language, filters: AdminDashboardFilters = {}) =>
    ['adminDashboard', 'summary', locale, filters.countryCode, filters.projectCode, filters.craftCode] as const,
};
