// The "registered between" filter every admin list, dashboard and report
// shares: `filter[registered_from]` / `filter[registered_to]` bound the
// candidate's registration (added or imported) day, a calendar day in
// Pakistan time (descon-be's Admin::RegisteredDateFilter). Candidates are
// imported in batches, so this is how staff look at one batch.

export interface RegisteredDateRange {
  /** YYYY-MM-DD. */
  registeredFrom?: string;
  /** YYYY-MM-DD. */
  registeredTo?: string;
}

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a value is a real YYYY-MM-DD day the backend will accept. */
export function isIsoDay(value: string | null | undefined): value is string {
  if (!value || !ISO_DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Appends the two filters onto a query-string parts list, for whichever is set. */
export function appendRegisteredDateParams(params: string[], range: RegisteredDateRange): void {
  if (range.registeredFrom) params.push(`${encodeURIComponent('filter[registered_from]')}=${encodeURIComponent(range.registeredFrom)}`);
  if (range.registeredTo) params.push(`${encodeURIComponent('filter[registered_to]')}=${encodeURIComponent(range.registeredTo)}`);
}

/** Reads the range from a page's URL (`registered_from` / `registered_to`), dropping malformed days. */
export function readRegisteredDateRange(searchParams: URLSearchParams): RegisteredDateRange {
  const from = searchParams.get('registered_from');
  const to = searchParams.get('registered_to');
  return { registeredFrom: isIsoDay(from) ? from : undefined, registeredTo: isIsoDay(to) ? to : undefined };
}

/** Writes the range into a page's URL; the inverse of `readRegisteredDateRange`. */
export function writeRegisteredDateRange(params: URLSearchParams, range: RegisteredDateRange): void {
  if (range.registeredFrom) params.set('registered_from', range.registeredFrom);
  if (range.registeredTo) params.set('registered_to', range.registeredTo);
}
