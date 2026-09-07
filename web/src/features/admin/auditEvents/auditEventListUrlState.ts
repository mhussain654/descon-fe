// Pure translation between the audit explorer's URL search params and its
// typed filter/sort/page state -- kept separate from the component so
// "does a refresh/back/forward restore filters" is directly unit-testable
// without mounting a router, mirroring
// web/src/features/admin/payments/paymentListUrlState.ts's identical
// structure.
import type { AuditEventListFilters, AuditEventListPage, AuditEventListSort } from '../../../lib/admin-audit-events-client';

export const DEFAULT_PAGE_SIZE = 20;

const SORTS = ['occurred_at', '-occurred_at'] as const;

function isAuditEventListSort(value: string): value is AuditEventListSort {
  return (SORTS as readonly string[]).includes(value);
}

/** ISO 8601 date only (YYYY-MM-DD), matching Admin::AuditEvents::IndexQuery's own Date.iso8601 parsing -- an obviously-malformed value is dropped rather than forwarded to the backend, which would otherwise reject it with a 400. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface AuditEventListUrlState {
  filters: AuditEventListFilters;
  sort: AuditEventListSort | undefined;
  page: AuditEventListPage;
}

/**
 * Reads the audit explorer's filters/sort/page from URL search params.
 * There is no backend-default filter to fall back to -- an absent filter
 * genuinely means "show every event", matching
 * Admin::AuditEvents::IndexQuery's own behavior when a filter param is
 * omitted. An unrecognized sort value is dropped rather than forwarded to
 * the backend, which would otherwise reject it with a 400.
 */
export function readAuditEventListStateFromSearchParams(searchParams: URLSearchParams): AuditEventListUrlState {
  const sortParam = searchParams.get('sort');
  const pageNumber = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('size'));
  const occurredFrom = searchParams.get('from');
  const occurredTo = searchParams.get('to');

  return {
    filters: {
      actor: searchParams.get('actor') || undefined,
      action: searchParams.get('action') || undefined,
      entityType: searchParams.get('entity_type') || undefined,
      candidate: searchParams.get('candidate') || undefined,
      occurredFrom: occurredFrom && isIsoDate(occurredFrom) ? occurredFrom : undefined,
      occurredTo: occurredTo && isIsoDate(occurredTo) ? occurredTo : undefined,
    },
    sort: sortParam && isAuditEventListSort(sortParam) ? sortParam : undefined,
    page: {
      number: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    },
  };
}

/** Builds the URL search params for a given filter/sort/page state -- the inverse of `readAuditEventListStateFromSearchParams`. Every set value is written explicitly, except page/size, which are omitted when they're already page 1 of the default size -- keeping the URL clean on first load. */
export function writeAuditEventListStateToSearchParams(
  filters: AuditEventListFilters,
  sort: AuditEventListSort | undefined,
  page: AuditEventListPage
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.actor) params.set('actor', filters.actor);
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entity_type', filters.entityType);
  if (filters.candidate) params.set('candidate', filters.candidate);
  if (filters.occurredFrom) params.set('from', filters.occurredFrom);
  if (filters.occurredTo) params.set('to', filters.occurredTo);
  if (sort) params.set('sort', sort);
  if (page.number && page.number !== 1) params.set('page', String(page.number));
  if (page.size && page.size !== DEFAULT_PAGE_SIZE) params.set('size', String(page.size));

  return params;
}
