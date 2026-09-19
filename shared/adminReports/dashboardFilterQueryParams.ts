// Shared query-string fragment for the filter[country_code]/project_code/
// craft_code vocabulary every admin dashboard endpoint accepts (see
// DashboardFilters in ./types) -- extracted here so
// shared/adminDashboard/dashboardQueryParams.ts and
// shared/adminMpsDashboard/mpsDashboardQueryParams.ts don't each redeclare
// the same 3 `if` checks.
import type { DashboardFilters } from './types';

/** Rails' Rack::Utils.parse_nested_query accepts percent-encoded brackets the same as raw ones, so encodeURIComponent on the whole `filter[x]` key is standard and safe here. */
export function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/** Appends filter[country_code]/project_code/craft_code onto `params` for any filter that's set. */
export function appendDashboardFilterParams(params: string[], filters: DashboardFilters): void {
  if (filters.countryCode) {
    appendParam(params, 'filter[country_code]', filters.countryCode);
  }
  if (filters.projectCode) {
    appendParam(params, 'filter[project_code]', filters.projectCode);
  }
  if (filters.craftCode) {
    appendParam(params, 'filter[craft_code]', filters.craftCode);
  }
}
