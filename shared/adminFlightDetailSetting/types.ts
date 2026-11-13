// Admin default flight details types, wired to the real backend documented
// in descon-be's openapi.yaml:
//   GET   /api/v1/admin/flight_detail_setting
//   PATCH /api/v1/admin/flight_detail_setting
//
// The airline, flight number, sector and departure date and time filled in when
// staff add a candidate's flight details. Each candidate keeps their own copy, so
// changing these only affects candidates added afterwards. Web-only.

export interface FlightDetailSettingActorRef {
  id: string;
  role: string;
}

export interface AdminFlightDetailSetting {
  airline: string | null;
  flightNumber: string | null;
  sector: string | null;
  /** YYYY-MM-DD. */
  departureOn: string | null;
  /** HH:MM, 24-hour. Set or cleared together with departureOn. */
  departureTime: string | null;
  updatedBy?: FlightDetailSettingActorRef;
  updatedAt: string;
}

/** Blank values clear that default. */
export interface AdminFlightDetailSettingUpdateInput {
  airline: string;
  flightNumber: string;
  sector: string;
  departureOn: string;
  departureTime: string;
}

export type AdminFlightDetailSettingErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminFlightDetailSettingError {
  code: AdminFlightDetailSettingErrorCode;
  /** Already-localized server message, when the backend provided one. */
  message?: string;
  field?: string;
}

export interface AdminFlightDetailSettingClient {
  getFlightDetailSetting(): Promise<AdminFlightDetailSetting>;
  updateFlightDetailSetting(input: AdminFlightDetailSettingUpdateInput): Promise<AdminFlightDetailSetting>;
}
