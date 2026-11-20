// The admin candidate list's `filter[flight_date]` is a calendar day in
// Pakistan time (descon-be's Admin::Candidates::IndexQuery), since candidates
// fly out of Pakistan.
const FLIGHT_DATE_TIME_ZONE = 'Asia/Karachi';
const FLIGHT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Pakistan as YYYY-MM-DD, for the "Today's flights" shortcut. */
export function flightDateToday(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: FLIGHT_DATE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whether a value is a YYYY-MM-DD date the backend will accept. */
export function isFlightDate(value: string | null | undefined): value is string {
  if (!value || !FLIGHT_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
