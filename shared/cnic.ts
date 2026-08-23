// Pure CNIC formatting logic shared by the web and mobile CnicField
// presentations (AGENTS.md: "Share ... pure logic when they are genuinely
// platform-independent"). No platform APIs, no business/validation rules --
// backend validation remains the source of truth for whether a CNIC is valid.

const CNIC_DIGIT_COUNT = 13;

/** Strips everything but digits and caps at the 13-digit CNIC length. */
export function toCnicDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CNIC_DIGIT_COUNT);
}

/** Formats raw CNIC digits as `XXXXX-XXXXXXX-X` for display. */
export function formatCnic(digits: string): string {
  const value = toCnicDigits(digits);
  const parts = [value.slice(0, 5), value.slice(5, 12), value.slice(12, 13)].filter(Boolean);
  return parts.join('-');
}

/** True once `digits` is a complete, well-formed 13-digit CNIC. Frontend format check only -- the backend remains the source of truth for whether it belongs to a real candidate. */
export function isValidCnic(digits: string): boolean {
  return /^\d{13}$/.test(digits);
}
