// Pure conversion between an ISO 8601 UTC timestamp (what the backend's
// filter[submitted_from]/filter[submitted_to] expect, per
// Admin::DocumentReviewQueueParams's `Time.iso8601`) and the value an
// `<input type="datetime-local">` needs/produces (a timezone-less local
// wall-clock string) -- kept as pure functions so the round-trip is directly
// unit-testable without mounting the filter UI.

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** ISO 8601 -> the local value a datetime-local input expects (`YYYY-MM-DDTHH:mm`). Returns '' for an unset/unparseable value so the input renders empty rather than throwing. */
export function isoToDatetimeLocalValue(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The local value from a datetime-local input -> an ISO 8601 UTC timestamp. Returns undefined for an empty/unparseable value. */
export function datetimeLocalValueToIso(localValue: string): string | undefined {
  if (!localValue) return undefined;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
