// Query key factory for the Admin dashboard (MPS-801).
import type { Language } from '../i18n/translations';

export const adminDashboardQueries = {
  summary: (locale: Language) => ['adminDashboard', 'summary', locale] as const,
};
