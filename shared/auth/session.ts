/**
 * Structural, not `AuthSession`-specific -- any session shape with a
 * server-declared `expiresAt` (candidate `AuthSession`, staff `StaffSession`)
 * satisfies this without needing its own copy of the same expiry check.
 */
interface ExpiringSession {
  expiresAt: string;
}

/** True while `session` exists and hasn't passed its server-declared `expiresAt`. */
export function isSessionValid(session: ExpiringSession | null | undefined, now: number = Date.now()): boolean {
  if (!session) return false;
  return new Date(session.expiresAt).getTime() > now;
}

/** Renew the access token this many seconds before it expires, rather than waiting for it to lapse. */
export const REFRESH_BEFORE_EXPIRY_SECONDS = 60;

/** True once `session` is within the renewal window (or already past expiry). */
export function isSessionDueForRefresh(session: ExpiringSession, now: number = Date.now()): boolean {
  return new Date(session.expiresAt).getTime() - now <= REFRESH_BEFORE_EXPIRY_SECONDS * 1000;
}
