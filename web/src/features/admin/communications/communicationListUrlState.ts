// Pure translation between the communications log's URL search params and
// its typed filter/sort/page state -- kept separate from the component so
// "does a refresh/back/forward restore filters" is directly unit-testable
// without mounting a router, mirroring
// web/src/features/admin/auditEvents/auditEventListUrlState.ts's identical
// structure.
import type { CommunicationListFilters, CommunicationListPage, CommunicationListSort } from '../../../lib/admin-communications-client';

export const DEFAULT_PAGE_SIZE = 20;

const SORTS = ['created_at', '-created_at'] as const;
const DIRECTIONS = ['inbound', 'outbound'] as const;

function isCommunicationListSort(value: string): value is CommunicationListSort {
  return (SORTS as readonly string[]).includes(value);
}

function isDirection(value: string): value is 'inbound' | 'outbound' {
  return (DIRECTIONS as readonly string[]).includes(value);
}

/** ISO 8601 date only (YYYY-MM-DD), matching Admin::Communications::IndexQuery's own Date.iso8601 parsing -- an obviously-malformed value is dropped rather than forwarded to the backend, which would otherwise reject it with a 400. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface CommunicationListUrlState {
  filters: CommunicationListFilters;
  sort: CommunicationListSort | undefined;
  page: CommunicationListPage;
}

/**
 * Reads the communications log's filters/sort/page from URL search params.
 * There is no backend-default filter to fall back to -- an absent filter
 * genuinely means "show every communication", matching
 * Admin::Communications::IndexQuery's own behavior when a filter param is
 * omitted. An unrecognized sort/direction value is dropped rather than
 * forwarded to the backend, which would otherwise reject it with a 400.
 */
export function readCommunicationListStateFromSearchParams(searchParams: URLSearchParams): CommunicationListUrlState {
  const sortParam = searchParams.get('sort');
  const directionParam = searchParams.get('direction');
  const pageNumber = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('size'));
  const occurredFrom = searchParams.get('from');
  const occurredTo = searchParams.get('to');

  return {
    filters: {
      channel: searchParams.get('channel') || undefined,
      direction: directionParam && isDirection(directionParam) ? directionParam : undefined,
      status: searchParams.get('status') || undefined,
      candidateAssignment: searchParams.get('assignment') || undefined,
      candidate: searchParams.get('candidate') || undefined,
      occurredFrom: occurredFrom && isIsoDate(occurredFrom) ? occurredFrom : undefined,
      occurredTo: occurredTo && isIsoDate(occurredTo) ? occurredTo : undefined,
    },
    sort: sortParam && isCommunicationListSort(sortParam) ? sortParam : undefined,
    page: {
      number: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    },
  };
}

/** Builds the URL search params for a given filter/sort/page state -- the inverse of `readCommunicationListStateFromSearchParams`. Every set value is written explicitly, except page/size, which are omitted when they're already page 1 of the default size -- keeping the URL clean on first load. */
export function writeCommunicationListStateToSearchParams(
  filters: CommunicationListFilters,
  sort: CommunicationListSort | undefined,
  page: CommunicationListPage
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.channel) params.set('channel', filters.channel);
  if (filters.direction) params.set('direction', filters.direction);
  if (filters.status) params.set('status', filters.status);
  if (filters.candidateAssignment) params.set('assignment', filters.candidateAssignment);
  if (filters.candidate) params.set('candidate', filters.candidate);
  if (filters.occurredFrom) params.set('from', filters.occurredFrom);
  if (filters.occurredTo) params.set('to', filters.occurredTo);
  if (sort) params.set('sort', sort);
  if (page.number && page.number !== 1) params.set('page', String(page.number));
  if (page.size && page.size !== DEFAULT_PAGE_SIZE) params.set('size', String(page.size));

  return params;
}
