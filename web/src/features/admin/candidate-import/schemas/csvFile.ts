// Client-side CSV file validation for the admin candidate-import screen.
// This is a UX improvement only -- the backend (descon-be's
// Admin::Candidates::Imports::CsvFileParser) remains the authoritative
// validator and enforces its own configured limits regardless of what this
// file checks (AGENTS.md: "Frontend validation improves UX but never
// replaces backend validation").
//
// MAX_FILE_BYTES mirrors the backend's *default* CANDIDATE_IMPORT_MAX_BYTES
// (see descon-be/.env.example: 2097152) -- a deployment that overrides that
// env var will disagree with this constant, and the backend's own 422
// response is what actually governs. There is no API-exposed way to learn
// the live configured value, so this is a documented best-effort default,
// not a guarantee.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Mirrors descon-be's CsvFileParser::REQUIRED_HEADERS exactly (openapi.yaml's CandidateImportRequest doesn't enumerate them -- they come from the backend's actual parser). */
export const REQUIRED_HEADERS = [
  'full_name',
  'cnic',
  'mobile_number',
  'reference_number',
  'preferred_locale',
  'candidate_status',
  'workflow_stage_code',
  'country_code',
  'project_code',
  'craft_code',
  'active',
] as const;

const ALLOWED_MIME_TYPES = new Set(['', 'text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel']);

export type CsvFileValidationError = 'FILE_REQUIRED' | 'INVALID_TYPE' | 'FILE_TOO_LARGE';

/** Returns the first validation problem with `file`, or `null` if it passes every client-side check. */
export function validateCsvFile(file: File | null): CsvFileValidationError | null {
  if (!file) return 'FILE_REQUIRED';

  const hasCsvExtension = file.name.toLowerCase().endsWith('.csv');
  const hasAllowedMimeType = ALLOWED_MIME_TYPES.has(file.type);
  if (!hasCsvExtension || !hasAllowedMimeType) return 'INVALID_TYPE';

  if (file.size > MAX_FILE_BYTES) return 'FILE_TOO_LARGE';

  return null;
}

/** A downloadable starter CSV with the required header row and one worked example -- generated entirely client-side, no backend endpoint needed. */
export function buildCsvTemplate(): string {
  const header = REQUIRED_HEADERS.join(',');
  const sampleRow = [
    'Ahmed Ali',
    '42101-1234567-1',
    '+923001234567',
    'DES-001001',
    'en',
    'registered',
    'registered',
    'qatar',
    'qatar_infrastructure',
    'electrician',
    'true',
  ].join(',');
  return `${header}\n${sampleRow}\n`;
}
