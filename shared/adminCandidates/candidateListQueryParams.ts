// Pure query-string builder for GET /api/v1/admin/candidates. Kept separate
// from the client so query-parameter serialization is directly unit-testable
// without mocking fetch, mirroring
// shared/adminDocumentReviews/queueQueryParams.ts's identical rationale.
import type { AdminCandidateListFilters, AdminCandidateListPage, AdminCandidateListSort } from './types';

/** Rails' Rack::Utils.parse_nested_query accepts percent-encoded brackets the same as raw ones, so encodeURIComponent on the whole `filter[x]`/`page[x]` key is standard and safe here. */
function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/**
 * Builds the query string for the candidate list endpoint. Omits any filter
 * that isn't set, and omits `sort` entirely when unset so the backend
 * applies its own default ordering (created_at desc) rather than this
 * module inventing one.
 */
export function buildCandidateListQuery(
  filters: AdminCandidateListFilters,
  sort: AdminCandidateListSort | undefined,
  page: AdminCandidateListPage
): string {
  const params: string[] = [];

  if (filters.search) {
    appendParam(params, 'search', filters.search);
  }
  if (filters.status) {
    appendParam(params, 'filter[status]', filters.status);
  }
  if (filters.countryCode) {
    appendParam(params, 'filter[country_code]', filters.countryCode);
  }
  if (filters.projectCode) {
    appendParam(params, 'filter[project_code]', filters.projectCode);
  }
  if (filters.craftCode) {
    appendParam(params, 'filter[craft_code]', filters.craftCode);
  }
  if (sort) {
    appendParam(params, 'sort', sort);
  }
  if (page.number) {
    appendParam(params, 'page[number]', String(page.number));
  }
  if (page.size) {
    appendParam(params, 'page[size]', String(page.size));
  }

  return params.length > 0 ? `?${params.join('&')}` : '';
}
