// Pure query-string builder for GET /api/v1/admin/candidate_imports (the
// import history list). Kept separate from the client so query-parameter
// serialization is directly unit-testable without mocking fetch, mirroring
// shared/adminCandidates/candidateListQueryParams.ts's identical rationale.
import type { CandidateImportHistoryFilters, CandidateImportHistoryPage } from './types';

/** Rails' Rack::Utils.parse_nested_query accepts percent-encoded brackets the same as raw ones, so encodeURIComponent on the whole `filter[x]`/`page[x]` key is standard and safe here. */
function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/** Builds the query string for the import history endpoint. Omits any filter that isn't set, and omits `sort` entirely (this module never sends one), letting the backend apply its own default ordering (created_at desc). */
export function buildImportHistoryQuery(filters: CandidateImportHistoryFilters, page: CandidateImportHistoryPage): string {
  const params: string[] = [];

  if (filters.status) {
    appendParam(params, 'filter[status]', filters.status);
  }
  if (filters.createdFrom) {
    appendParam(params, 'filter[created_from]', filters.createdFrom);
  }
  if (filters.createdTo) {
    appendParam(params, 'filter[created_to]', filters.createdTo);
  }
  if (filters.templateVersion) {
    appendParam(params, 'filter[template_version]', filters.templateVersion);
  }
  if (page.number) {
    appendParam(params, 'page[number]', String(page.number));
  }
  if (page.size) {
    appendParam(params, 'page[size]', String(page.size));
  }

  return params.length > 0 ? `?${params.join('&')}` : '';
}
