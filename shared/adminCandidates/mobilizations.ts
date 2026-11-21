// The admin Mobilization list (GET /api/v1/admin/mobilizations): every
// candidate whose flight is recorded, from booking through to mobilization.
// Types, query-string builder and response mapping, kept pure so they are
// unit-testable without fetch.
import type { AdminCandidatePagination } from './types';
import { toBoardingPassCheck, type BoardingPassCheck } from '../adminWorkflow/types';
import { appendRegisteredDateParams, type RegisteredDateRange } from './registeredDates';

/**
 * Departure status on today's Pakistan date (CandidateFlightDetail#departure_status):
 * `departed` once staff record the mobilization or, after the flight's day, once the
 * candidate has uploaded a boarding pass; `not_confirmed` when the day passed with neither.
 */
export const MOBILIZATION_STATUSES = ['scheduled', 'departing_today', 'departed', 'not_confirmed'] as const;
export type MobilizationStatus = (typeof MOBILIZATION_STATUSES)[number];

export function isMobilizationStatus(value: unknown): value is MobilizationStatus {
  return typeof value === 'string' && (MOBILIZATION_STATUSES as readonly string[]).includes(value);
}
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
  /** What the automatic OCR check found on the boarding pass; null before an upload. */
  boardingPassCheck: BoardingPassCheck | null;
  /** Whether staff rejected the uploaded boarding pass. */
  boardingPassRejected: boolean;
  /** YYYY-MM-DD, or null before mobilization. */
  mobilizedOn: string | null;
  status: MobilizationStatus;
}

/** Each group is counted under every active filter except its own. */
export interface MobilizationSummary {
  total: number;
  boardingPass: { uploaded: number; missing: number };
  status: Record<MobilizationStatus, number>;
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
  boarding_pass_check?: unknown;
  boarding_pass_rejected?: boolean;
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
    boardingPassCheck: toBoardingPassCheck(raw.boarding_pass_check),
    boardingPassRejected: raw.boarding_pass_rejected === true,
    mobilizedOn: raw.mobilized_on,
    // An unknown value is shown as needing a check rather than as a confident state.
    status: isMobilizationStatus(raw.status) ? raw.status : 'not_confirmed',
  };
}

const count = (value: unknown): number => (typeof value === 'number' ? value : 0);

export function toMobilizationSummary(raw: unknown): MobilizationSummary {
  const value = (raw && typeof raw === 'object' ? raw : {}) as {
    total?: unknown;
    boarding_pass?: { uploaded?: unknown; missing?: unknown };
    status?: Partial<Record<MobilizationStatus, unknown>>;
  };
  return {
    total: count(value.total),
    boardingPass: { uploaded: count(value.boarding_pass?.uploaded), missing: count(value.boarding_pass?.missing) },
    status: Object.fromEntries(MOBILIZATION_STATUSES.map((state) => [state, count(value.status?.[state])])) as Record<MobilizationStatus, number>,
  };
}

export type { MobilizationRowResponse };
