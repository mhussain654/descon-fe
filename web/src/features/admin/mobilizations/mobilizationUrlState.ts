// The Mobilization list's filters, sort and page live in the URL, so a
// refresh, back/forward or a shared link keeps the same view.
import { isFlightDate } from '../../../../../shared/adminCandidates/flightDate';
import { readRegisteredDateRange, writeRegisteredDateRange } from '../../../../../shared/adminCandidates/registeredDates';
import type { MobilizationFilters, MobilizationPage, MobilizationSort } from '../../../../../shared/adminCandidates/mobilizations';

export const DEFAULT_PAGE_SIZE = 20;

export interface MobilizationUrlState {
  filters: MobilizationFilters;
  sort: MobilizationSort | undefined;
  page: MobilizationPage;
}

export function readMobilizationStateFromSearchParams(searchParams: URLSearchParams): MobilizationUrlState {
  const flightDate = searchParams.get('flight_date');
  const boardingPass = searchParams.get('boarding_pass');
  const status = searchParams.get('status');
  const sort = searchParams.get('sort');
  const pageNumber = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('size'));

  return {
    filters: {
      search: searchParams.get('search') || undefined,
      flightDate: isFlightDate(flightDate) ? flightDate : undefined,
      boardingPass: boardingPass === 'uploaded' || boardingPass === 'missing' ? boardingPass : undefined,
      status: status === 'awaiting_departure' || status === 'mobilized' ? status : undefined,
      countryCode: searchParams.get('country') || undefined,
      ...readRegisteredDateRange(searchParams),
    },
    sort: sort === 'departure_at' || sort === '-departure_at' ? sort : undefined,
    page: {
      number: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    },
  };
}

export function writeMobilizationStateToSearchParams(filters: MobilizationFilters, sort: MobilizationSort | undefined, page: MobilizationPage): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.flightDate) params.set('flight_date', filters.flightDate);
  if (filters.boardingPass) params.set('boarding_pass', filters.boardingPass);
  if (filters.status) params.set('status', filters.status);
  if (filters.countryCode) params.set('country', filters.countryCode);
  writeRegisteredDateRange(params, filters);
  if (sort) params.set('sort', sort);
  if (page.number && page.number !== 1) params.set('page', String(page.number));
  if (page.size && page.size !== DEFAULT_PAGE_SIZE) params.set('size', String(page.size));
  return params;
}
