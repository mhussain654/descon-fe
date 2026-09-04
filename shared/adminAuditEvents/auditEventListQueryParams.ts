// Pure query-string builder for GET /api/v1/admin/audit_events. Kept
// separate from the client so query-parameter serialization is directly
// unit-testable without mocking fetch, mirroring
// shared/adminPayments/paymentListQueryParams.ts's identical rationale.
import type { AuditEventListFilters, AuditEventListPage, AuditEventListSort } from './types';

/** Rails' Rack::Utils.parse_nested_query accepts percent-encoded brackets the same as raw ones, so encodeURIComponent on the whole `filter[x]`/`page[x]` key is standard and safe here. */
function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/** Builds the query string for the audit event list endpoint. Omits any filter/sort/page value that isn't set, letting the backend apply its own defaults (occurred_at desc, page 1, size 20). */
export function buildAuditEventListQuery(
  filters: AuditEventListFilters,
  sort: AuditEventListSort | undefined,
  page: AuditEventListPage
): string {
  const params: string[] = [];

  if (filters.actor) appendParam(params, 'filter[actor]', filters.actor);
  if (filters.action) appendParam(params, 'filter[action]', filters.action);
  if (filters.entityType) appendParam(params, 'filter[entity_type]', filters.entityType);
  if (filters.candidate) appendParam(params, 'filter[candidate]', filters.candidate);
  if (filters.occurredFrom) appendParam(params, 'filter[occurred_from]', filters.occurredFrom);
  if (filters.occurredTo) appendParam(params, 'filter[occurred_to]', filters.occurredTo);
  if (sort) appendParam(params, 'sort', sort);
  if (page.number) appendParam(params, 'page[number]', String(page.number));
  if (page.size) appendParam(params, 'page[size]', String(page.size));

  return params.length > 0 ? `?${params.join('&')}` : '';
}
