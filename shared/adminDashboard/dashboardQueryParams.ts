// Pure query-string builder for GET /api/v1/admin/dashboard. Kept separate
// from the client so query-parameter serialization is directly unit-testable
// without mocking fetch, mirroring
// shared/adminCandidates/candidateListQueryParams.ts's identical rationale.
import { appendDashboardFilterParams } from '../adminReports/dashboardFilterQueryParams';
import type { AdminDashboardFilters } from './types';

/** Builds the query string for the dashboard endpoint. Omits any filter that isn't set. */
export function buildDashboardQuery(filters: AdminDashboardFilters): string {
  const params: string[] = [];
  appendDashboardFilterParams(params, filters);

  return params.length > 0 ? `?${params.join('&')}` : '';
}
