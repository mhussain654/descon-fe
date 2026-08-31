// Pure passport-number normalization/validation, mirroring the backend's
// own logic exactly (Candidate#normalize_passport_number /
// Candidate::PASSPORT_NUMBER_FORMAT). Optional field -- an empty/blank
// result means "no passport number," never invalid.

const PASSPORT_NUMBER_FORMAT = /^[A-Z0-9-]+$/;

/** Mirrors the backend's own normalization exactly: uppercase, strip whitespace. */
export function normalizePassportNumber(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}

/** True for a blank value (no passport number, always valid) or one matching the backend's format. Frontend format check only -- the backend remains the source of truth. */
export function isValidPassportNumber(normalized: string): boolean {
  return normalized === '' || PASSPORT_NUMBER_FORMAT.test(normalized);
}
