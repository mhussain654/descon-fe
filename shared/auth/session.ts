import type { AuthSession } from './types';

/** True while `session` exists and hasn't passed its server-declared `expiresAt`. */
export function isSessionValid(session: AuthSession | null | undefined, now: number = Date.now()): boolean {
  if (!session) return false;
  return new Date(session.expiresAt).getTime() > now;
}
