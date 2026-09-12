// Pure query-string builder for GET /api/v1/admin/communications. Kept
// separate from the client so query-parameter serialization is directly
// unit-testable without mocking fetch, mirroring
// shared/adminAuditEvents/auditEventListQueryParams.ts's identical rationale.
import type { CommunicationListFilters, CommunicationListPage, CommunicationListSort } from './types';

/** Rails' Rack::Utils.parse_nested_query accepts percent-encoded brackets the same as raw ones, so encodeURIComponent on the whole `filter[x]`/`page[x]` key is standard and safe here. */
function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/** Builds the query string for the communications list endpoint. Omits any filter/sort/page value that isn't set, letting the backend apply its own defaults (created_at desc, page 1, size 20). */
export function buildCommunicationListQuery(
  filters: CommunicationListFilters,
  sort: CommunicationListSort | undefined,
  page: CommunicationListPage
): string {
  const params: string[] = [];

  if (filters.channel) appendParam(params, 'filter[channel]', filters.channel);
  if (filters.direction) appendParam(params, 'filter[direction]', filters.direction);
  if (filters.status) appendParam(params, 'filter[status]', filters.status);
  if (filters.candidateAssignment) appendParam(params, 'filter[candidate_assignment]', filters.candidateAssignment);
  if (filters.candidate) appendParam(params, 'filter[candidate]', filters.candidate);
  if (filters.occurredFrom) appendParam(params, 'filter[occurred_from]', filters.occurredFrom);
  if (filters.occurredTo) appendParam(params, 'filter[occurred_to]', filters.occurredTo);
  if (sort) appendParam(params, 'sort', sort);
  if (page.number) appendParam(params, 'page[number]', String(page.number));
  if (page.size) appendParam(params, 'page[size]', String(page.size));

  return params.length > 0 ? `?${params.join('&')}` : '';
}
