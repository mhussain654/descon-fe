// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { isSessionValid } from './session';
import type { AuthSession } from './types';

const session: AuthSession = {
  accessToken: 'token',
  candidateId: 'candidate_1',
  expiresAt: new Date(10_000).toISOString(),
};

describe('isSessionValid', () => {
  it('is false for null/undefined', () => {
    expect(isSessionValid(null)).toBe(false);
    expect(isSessionValid(undefined)).toBe(false);
  });

  it('is true before expiresAt and false at/after it', () => {
    expect(isSessionValid(session, 9_000)).toBe(true);
    expect(isSessionValid(session, 10_000)).toBe(false);
    expect(isSessionValid(session, 11_000)).toBe(false);
  });
});
