// Safe formatting for the admin document-review workspace. File-size
// formatting is genuinely platform/feature-independent -- reused directly
// from candidateDocuments rather than duplicated (AGENTS.md: "Do not
// duplicate logic").
import type { Language } from '../i18n/translations';
import { formatDate } from '../i18n/locale';

export { formatFileSize } from '../candidateDocuments/formatting';

/**
 * Locale-aware date+time formatting that never throws on a malformed value
 * -- `Intl.DateTimeFormat.format()` throws on an invalid Date, and every
 * timestamp here (submitted_at, uploaded_at, verified_at, expires_at) comes
 * from a backend response this module must not trust blindly. Returns an
 * empty string for anything unparseable so a display component can decide
 * its own fallback (e.g. an em dash) rather than this module inventing UI copy.
 */
export function formatReviewDateTime(value: string | undefined, language: Language): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return formatDate(date, language, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}
