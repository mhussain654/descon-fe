// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { isSessionDueForRefresh, isSessionValid } from './session';
import type { AuthSession } from './types';

const session: AuthSession = {
  accessToken: 'token',
  refreshToken: 'refresh',
  candidateId: 'candidate_1',
  candidateName: 'Ahmed Ali',
  preferredLocale: 'en',
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

describe('isSessionDueForRefresh', () => {
  it('is false while the access token has more than the renewal window left', () => {
    expect(isSessionDueForRefresh(session, 10_000 - 61_000)).toBe(false);
  });

  it('is true inside the renewal window and after expiry', () => {
    expect(isSessionDueForRefresh(session, 10_000 - 60_000)).toBe(true);
    expect(isSessionDueForRefresh(session, 9_000)).toBe(true);
    expect(isSessionDueForRefresh(session, 20_000)).toBe(true);
  });
});
