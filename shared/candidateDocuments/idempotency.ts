// Pure idempotency-key lifecycle for the document upload flow. Platform
// hooks (web/mobile) own the actual file/requirement selection state and
// call `resolveIdempotencyKey` whenever it changes; this module only
// decides reuse-vs-mint and never touches a real file object -- platform
// code reduces its selected file down to an opaque `fileSignature` string
// first (e.g. `${name}:${size}:${lastModified}` on web).

export interface IdempotencyKeySelection {
  requirementCode: string;
  fileSignature: string;
}

export interface IdempotencyKeyState {
  key: string | null;
  selection: IdempotencyKeySelection | null;
}

export const EMPTY_IDEMPOTENCY_KEY_STATE: IdempotencyKeyState = { key: null, selection: null };

/**
 * Decides whether a new selection (a chosen requirement + file) should
 * reuse the current idempotency key or mint a fresh one. Reuses only when
 * both the requirement code and file signature exactly match the current
 * selection (ticket: "Reuse the same key when retrying the same file for
 * the same requirement. Generate a new key when the candidate selects a
 * different file. Generate a new key when the requirement changes. Do not
 * reuse one requirement's key for another requirement.").
 */
export function resolveIdempotencyKey(
  current: IdempotencyKeyState,
  next: IdempotencyKeySelection,
  generateKey: () => string
): IdempotencyKeyState {
  if (
    current.key &&
    current.selection &&
    current.selection.requirementCode === next.requirementCode &&
    current.selection.fileSignature === next.fileSignature
  ) {
    return current;
  }
  return { key: generateKey(), selection: next };
}

/** Clears the key after a confirmed successful upload -- a later attempt for the *same* file must mint a fresh key rather than replaying the now-consumed response for the old one. */
export function clearIdempotencyKey(): IdempotencyKeyState {
  return EMPTY_IDEMPOTENCY_KEY_STATE;
}

export function randomIdempotencyKey(): string {
  return `candidate-document-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
