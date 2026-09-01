// Pure mobile-number normalization/validation shared by web and mobile
// candidate-creation/editing forms (AGENTS.md: "Normalize CNIC and phone
// input consistently"). Mirrors the backend's own normalization exactly
// (Candidate#normalize_mobile_number / Admin::Candidates::CreateService):
// strip whitespace, keep only digits, restore a leading `+` if the raw
// input had one. Backend validation (Candidate::MOBILE_NUMBER_FORMAT)
// remains the source of truth; this is a UX improvement only.

const MOBILE_NUMBER_FORMAT = /^\+?\d{10,15}$/;

/** Mirrors the backend's own normalization exactly, so what the client sends is already in the stored form. */
export function normalizeMobileNumber(raw: string): string {
  const value = raw.trim();
  const digits = value.replace(/\D/g, '');
  return value.startsWith('+') ? `+${digits}` : digits;
}

/** True once `normalized` (already run through normalizeMobileNumber) matches the backend's own format. Frontend format check only -- the backend remains the source of truth. */
export function isValidMobileNumber(normalized: string): boolean {
  return MOBILE_NUMBER_FORMAT.test(normalized);
}
