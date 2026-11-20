// The admin candidate list's `filter[flight_date]` is a calendar day in
// Pakistan time (descon-be's Admin::Candidates::IndexQuery), since candidates
// fly out of Pakistan.
import { isIsoDay } from './registeredDates';

const FLIGHT_DATE_TIME_ZONE = 'Asia/Karachi';

/** Today's date in Pakistan as YYYY-MM-DD, for the "Today's flights" shortcut. */
export function flightDateToday(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: FLIGHT_DATE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whether a value is a YYYY-MM-DD date the backend will accept. */
export function isFlightDate(value: string | null | undefined): value is string {
  return isIsoDay(value);
}
