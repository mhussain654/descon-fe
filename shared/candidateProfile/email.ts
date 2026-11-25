// The candidate's own email address: the same rules the backend applies in
// Candidates::Profiles::EmailUpdateService (trimmed, lowercased, at most 254
// characters, something@domain.tld). The backend re-checks it.
export const EMAIL_MAX_LENGTH = 254;
const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** True for a well-formed address, and for an empty one (which clears it). */
export function isAcceptableEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return email === '' || (email.length <= EMAIL_MAX_LENGTH && EMAIL_FORMAT.test(email));
}
