// Pure query-string builder for GET /api/v1/admin/dashboard. Kept separate
// from the client so query-parameter serialization is directly unit-testable
// without mocking fetch, mirroring
// shared/adminCandidates/candidateListQueryParams.ts's identical rationale.
import type { AdminDashboardFilters } from './types';

/** Rails' Rack::Utils.parse_nested_query accepts percent-encoded brackets the same as raw ones, so encodeURIComponent on the whole `filter[x]` key is standard and safe here. */
function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/** Builds the query string for the dashboard endpoint. Omits any filter that isn't set. */
export function buildDashboardQuery(filters: AdminDashboardFilters): string {
  const params: string[] = [];

  if (filters.countryCode) {
    appendParam(params, 'filter[country_code]', filters.countryCode);
  }
  if (filters.projectCode) {
    appendParam(params, 'filter[project_code]', filters.projectCode);
  }
  if (filters.craftCode) {
    appendParam(params, 'filter[craft_code]', filters.craftCode);
  }

  return params.length > 0 ? `?${params.join('&')}` : '';
}
