// The admin Mobilization list (GET /api/v1/admin/mobilizations): every
// candidate whose flight is recorded, from booking through to mobilization.
// Types, query-string builder and response mapping, kept pure so they are
// unit-testable without fetch.
import type { AdminCandidatePagination } from './types';
import { appendRegisteredDateParams, type RegisteredDateRange } from './registeredDates';

export type MobilizationStatus = 'awaiting_departure' | 'mobilized';
export type MobilizationBoardingPassFilter = 'uploaded' | 'missing';
/** Matches Admin::Mobilizations::IndexQuery::ALLOWED_SORTS; the backend defaults to `-departure_at`. */
export type MobilizationSort = 'departure_at' | '-departure_at';

export interface MobilizationFilters extends RegisteredDateRange {
  search?: string;
  countryCode?: string;
  /** YYYY-MM-DD, a calendar day in Pakistan time. */
  flightDate?: string;
  boardingPass?: MobilizationBoardingPassFilter;
  status?: MobilizationStatus;
}

export interface MobilizationPage {
  number?: number;
  size?: number;
}

export interface MobilizationRow {
  id: string;
  candidate: {
    id: string;
    fullName: string;
    referenceNumber: string;
    countryName: string | null;
    projectName: string | null;
    craftName: string | null;
  };
  airline: string;
  flightNumber: string;
  sector: string | null;
  /** ISO 8601. */
  flightDepartureAt: string;
  ticketAttached: boolean;
  /** ISO 8601, or null before the candidate uploads one. */
  boardingPassUploadedAt: string | null;
  /** YYYY-MM-DD, or null before mobilization. */
  mobilizedOn: string | null;
  status: MobilizationStatus;
}

/** Each group is counted under every active filter except its own. */
export interface MobilizationSummary {
  total: number;
  boardingPass: { uploaded: number; missing: number };
  status: { awaitingDeparture: number; mobilized: number };
}

export interface MobilizationListResult {
  items: MobilizationRow[];
  pagination: AdminCandidatePagination;
  summary: MobilizationSummary;
}

function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

export function buildMobilizationListQuery(filters: MobilizationFilters, sort: MobilizationSort | undefined, page: MobilizationPage): string {
  const params: string[] = [];
  if (filters.search) appendParam(params, 'search', filters.search);
  if (filters.flightDate) appendParam(params, 'filter[flight_date]', filters.flightDate);
  if (filters.boardingPass) appendParam(params, 'filter[boarding_pass]', filters.boardingPass);
  if (filters.status) appendParam(params, 'filter[status]', filters.status);
  if (filters.countryCode) appendParam(params, 'filter[country_code]', filters.countryCode);
  appendRegisteredDateParams(params, filters);
  if (sort) appendParam(params, 'sort', sort);
  if (page.number) appendParam(params, 'page[number]', String(page.number));
  if (page.size) appendParam(params, 'page[size]', String(page.size));
  return params.length > 0 ? `?${params.join('&')}` : '';
}

interface MobilizationRowResponse {
  id: string;
  candidate: {
    id: string;
    full_name: string;
    reference_number: string;
    country_name: string | null;
    project_name: string | null;
    craft_name: string | null;
  };
  airline: string;
  flight_number: string;
  sector: string | null;
  flight_departure_at: string;
  ticket_attached: boolean;
  boarding_pass_uploaded_at: string | null;
  mobilized_on: string | null;
  status: MobilizationStatus;
}

export function toMobilizationRow(raw: MobilizationRowResponse): MobilizationRow {
  return {
    id: raw.id,
    candidate: {
      id: raw.candidate.id,
      fullName: raw.candidate.full_name,
      referenceNumber: raw.candidate.reference_number,
      countryName: raw.candidate.country_name,
      projectName: raw.candidate.project_name,
      craftName: raw.candidate.craft_name,
    },
    airline: raw.airline,
    flightNumber: raw.flight_number,
    sector: raw.sector,
    flightDepartureAt: raw.flight_departure_at,
    ticketAttached: raw.ticket_attached === true,
    boardingPassUploadedAt: raw.boarding_pass_uploaded_at,
    mobilizedOn: raw.mobilized_on,
    status: raw.status === 'mobilized' ? 'mobilized' : 'awaiting_departure',
  };
}

const count = (value: unknown): number => (typeof value === 'number' ? value : 0);

export function toMobilizationSummary(raw: unknown): MobilizationSummary {
  const value = (raw && typeof raw === 'object' ? raw : {}) as {
    total?: unknown;
    boarding_pass?: { uploaded?: unknown; missing?: unknown };
    status?: { awaiting_departure?: unknown; mobilized?: unknown };
  };
  return {
    total: count(value.total),
    boardingPass: { uploaded: count(value.boarding_pass?.uploaded), missing: count(value.boarding_pass?.missing) },
    status: { awaitingDeparture: count(value.status?.awaiting_departure), mobilized: count(value.status?.mobilized) },
  };
}

export type { MobilizationRowResponse };
