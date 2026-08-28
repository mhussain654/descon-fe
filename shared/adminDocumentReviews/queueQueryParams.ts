// Pure query-string builder for GET /api/v1/admin/document_submissions.
// Kept separate from the client so it's directly unit-testable (the ticket
// explicitly requires "Query-parameter serialization" coverage) without
// mocking fetch.
import type { DocumentReviewQueueFilters, DocumentReviewQueuePage } from './types';

/** Rails' Rack::Utils.parse_nested_query accepts percent-encoded brackets the same as raw ones, so encodeURIComponent on the whole `filter[x]`/`page[x]` key is standard and safe here. */
function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/**
 * Builds the query string for the review queue endpoint. Omits any filter
 * that isn't set -- for `status` in particular, omitting it entirely lets
 * the backend apply its own default (`pending_review, partially_reviewed`)
 * rather than this module inventing one (ticket: "Default queue behavior
 * should follow the backend defaults").
 */
export function buildDocumentReviewQueueQuery(
  filters: DocumentReviewQueueFilters,
  page: DocumentReviewQueuePage
): string {
  const params: string[] = [];

  if (filters.status && filters.status.length > 0) {
    appendParam(params, 'filter[status]', filters.status.join(','));
  }
  if (filters.submittedFrom) {
    appendParam(params, 'filter[submitted_from]', filters.submittedFrom);
  }
  if (filters.submittedTo) {
    appendParam(params, 'filter[submitted_to]', filters.submittedTo);
  }
  if (filters.candidatePublicId) {
    appendParam(params, 'filter[candidate_public_id]', filters.candidatePublicId);
  }
  if (filters.projectCode) {
    appendParam(params, 'filter[project_code]', filters.projectCode);
  }
  if (filters.countryCode) {
    appendParam(params, 'filter[country_code]', filters.countryCode);
  }
  if (page.number) {
    appendParam(params, 'page[number]', String(page.number));
  }
  if (page.size) {
    appendParam(params, 'page[size]', String(page.size));
  }

  return params.length > 0 ? `?${params.join('&')}` : '';
}
