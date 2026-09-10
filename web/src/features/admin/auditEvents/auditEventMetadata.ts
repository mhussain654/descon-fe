/**
 * Filters and formats an AuditEvent's `metadata` for display in
 * AuditEventList.tsx. The backend's serializer passes `metadata` through
 * as-is (see descon-be's Admin::AuditEventSerializer) with no field
 * allowlist of its own -- server-side filtering there remains the primary
 * control; this is defense in depth on the read side, not a replacement
 * for it.
 *
 * An allowlist (not a blocklist) by design: an unrecognized key is hidden,
 * never shown -- a newly-added *AuditRecorder somewhere in the backend
 * should have to be deliberately added here before its metadata renders,
 * rather than showing by default and risking a future sensitive field
 * leaking through unnoticed.
 */

// Every *AuditRecorder in the backend that stores a `reason`/`field`/
// `previous_value`/`new_value`/`before`/`after`/`details`/`evidence` key
// either free-types it (Admin::Payments::CorrectionService's staff-entered
// `reason`, or the value echoed by `previous_value`/`new_value`) or gives it
// an arbitrary-shaped hash (`before`/`after`/`details`/`evidence`) with no
// fixed contract -- never render these, even though most current call sites
// only ever put safe values in them today.
const BLOCKED_METADATA_KEYS = new Set(['reason', 'field', 'previous_value', 'new_value', 'before', 'after', 'details', 'evidence']);

// Every other metadata key observed across the backend's *AuditRecorder
// classes follows one of these suffixes: opaque public UUIDs (`_id`/`_ids`),
// enum/status codes (`_code`/`_codes`), timestamps/dates (`_at`/`_on`/`_date`/
// `_dates`), counts (`_count`/`_counts`/`_rows`/`_number`/`_numbers`), or a
// version/fingerprint (`_version`). A handful of exact names don't fit a
// suffix (flight logistics, booleans) and are listed explicitly.
const SAFE_METADATA_KEY_SUFFIXES = [
  '_id',
  '_ids',
  '_code',
  '_codes',
  '_at',
  '_on',
  '_date',
  '_dates',
  '_count',
  '_counts',
  '_rows',
  '_number',
  '_numbers',
  '_version',
];

const SAFE_METADATA_EXACT_KEYS = new Set([
  'airline',
  'flight_number',
  'sector',
  'no_show',
  'conflict',
  'replaced',
  'file_fingerprint',
  'action',
  'code',
]);

export function isApprovedMetadataKey(key: string): boolean {
  if (BLOCKED_METADATA_KEYS.has(key)) return false;
  if (SAFE_METADATA_EXACT_KEYS.has(key)) return true;
  return SAFE_METADATA_KEY_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

/**
 * Renders any value safely -- never `String(value)`, which turns a nested
 * object into the literal text "[object Object]" and could, for an
 * unexpectedly-shaped value, echo raw content a caller didn't intend to
 * approve just because its *key* passed the allowlist above.
 */
export function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    const allPrimitive = value.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean');
    return allPrimitive ? value.join(', ') : `(${value.length} items)`;
  }
  // Objects (and anything else unexpected) -- never inspected or
  // stringified, since that could still surface fields this module never
  // approved for display.
  return '(unavailable)';
}

/** Approved, safely-formatted metadata entries, in their original order. */
export function approvedMetadataEntries(metadata: Record<string, unknown>): [string, string][] {
  return Object.entries(metadata)
    .filter(([key]) => isApprovedMetadataKey(key))
    .map(([key, value]) => [key, formatMetadataValue(value)]);
}
