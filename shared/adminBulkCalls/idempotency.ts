// The Idempotency-Key lifecycle for starting a bulk call. The key is reused only
// while the selection is exactly the same -- so a double click or a retry after
// a dropped response replays the batch that was already started instead of
// starting a second one -- and a changed selection (or a deliberate new batch
// after a success) mints a fresh key. Mirrors shared/adminCandidateAiCalls/callIdempotency.ts.

export interface BulkCallSelection {
  voiceId: string;
  stageCode: string;
  limit: number;
  countryCode?: string;
  projectCode?: string;
  craftCode?: string;
  search?: string;
}

export interface BulkCallIdempotencyKeyState {
  key: string | null;
  selection: BulkCallSelection | null;
}

export const EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE: BulkCallIdempotencyKeyState = { key: null, selection: null };

function sameSelection(a: BulkCallSelection, b: BulkCallSelection): boolean {
  return (
    a.voiceId === b.voiceId &&
    a.stageCode === b.stageCode &&
    a.limit === b.limit &&
    a.countryCode === b.countryCode &&
    a.projectCode === b.projectCode &&
    a.craftCode === b.craftCode &&
    a.search === b.search
  );
}

export function resolveBulkCallIdempotencyKey(
  current: BulkCallIdempotencyKeyState,
  next: BulkCallSelection,
  generateKey: () => string
): BulkCallIdempotencyKeyState {
  if (current.key && current.selection && sameSelection(current.selection, next)) {
    return current;
  }
  return { key: generateKey(), selection: next };
}

/** After a confirmed success: the next batch, even with the same selection, is a new action and needs a new key. */
export function clearBulkCallIdempotencyKey(): BulkCallIdempotencyKeyState {
  return EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE;
}

export function randomBulkCallIdempotencyKey(): string {
  return `admin-bulk-call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
