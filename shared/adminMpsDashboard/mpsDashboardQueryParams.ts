// Pure query-string builder for GET /api/v1/admin/mps_dashboard. Kept
// separate from the client so query-parameter serialization is directly
// unit-testable without mocking fetch, mirroring
// shared/adminDashboard/dashboardQueryParams.ts's identical rationale.
import { appendDashboardFilterParams, appendParam } from '../adminReports/dashboardFilterQueryParams';
import type { MpsDashboardFilters, TrendGranularity } from './types';

/** Builds the query string for the MPS dashboard endpoint. Omits `granularity` and any filter that isn't set. */
export function buildMpsDashboardQuery(filters: MpsDashboardFilters, granularity?: TrendGranularity): string {
  const params: string[] = [];
  if (granularity) {
    appendParam(params, 'granularity', granularity);
  }
  appendDashboardFilterParams(params, filters);

  return params.length > 0 ? `?${params.join('&')}` : '';
}
