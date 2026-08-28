// Safe formatting for the admin document-review workspace. File-size
// formatting is genuinely platform/feature-independent -- reused directly
// from candidateDocuments rather than duplicated (AGENTS.md: "Do not
// duplicate logic").
import type { Language } from '../i18n/translations';
import { formatDate } from '../i18n/locale';
import type { ReferenceCode } from './types';

export { formatFileSize } from '../candidateDocuments/formatting';

/**
 * A reference record's display name, or `fallback` (an already-translated
 * "Name unavailable" string) when the backend didn't return one --
 * `ReferenceCode.name` is '' rather than the raw `code` for exactly this
 * case (see realAdminDocumentReviewsClient.ts's toReferenceCode), so this
 * is the one place every render site should read the name through, instead
 * of ever falling back to `.code` directly (ticket: "Do not translate...
 * backend enum values directly"; review finding: "Defensive mapping can
 * display raw project/country/craft codes").
 */
export function referenceDisplayName(reference: ReferenceCode, fallback: string): string {
  return reference.name || fallback;
}

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
