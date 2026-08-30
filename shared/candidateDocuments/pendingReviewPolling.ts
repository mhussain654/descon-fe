// Live-sync polling for the candidate document checklist (ticket: "While one
// or more required documents are pending_review, use a conservative
// visible-screen polling interval"). No polling precedent exists elsewhere
// in this repo to match, so this interval is a deliberate, documented
// choice rather than an inherited convention: 20s is frequent enough that a
// candidate waiting on an HR decision sees it promptly, but conservative
// enough not to meaningfully load the backend, especially since it only
// runs at all while a required document is actually pending and the
// screen/app is visible in the foreground (wired by the callers of this
// module via `refetchIntervalInBackground: false` and platform focus/
// foreground plumbing -- this module only decides *whether* to poll, not
// *when* to stop for visibility reasons).
import type { CandidateDocumentChecklistItem } from './types';

export const PENDING_REVIEW_POLL_INTERVAL_MS = 20_000;

export function hasPendingRequiredDocument(items: CandidateDocumentChecklistItem[] | undefined): boolean {
  if (!items) return false;
  return items.some((item) => item.required && item.status === 'pending_review');
}
