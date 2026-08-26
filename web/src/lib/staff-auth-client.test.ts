import { afterEach, describe, expect, it } from 'vitest';
import { staffAuthClient } from './staff-auth-client';

function successEnvelope(data: unknown) {
  return { data, meta: {}, errors: [] };
}

describe('staffAuthClient (web)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('is wired to the real backend -- posts to /auth/login and fetches /users/profile, not a mock', async () => {
    const calls: Array<[string, RequestInit]> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      if (url.includes('/auth/login')) {
        return new Response(
          JSON.stringify(
            successEnvelope({
              access_token: 'access-1',
              refresh_token: 'refresh-1',
              token_type: 'Bearer',
              expires_in: 900,
              session: { id: 'session-1' },
              user: { id: 'staff-1', email: 'admin@descon.com', role: 'admin' },
            })
          ),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify(
          successEnvelope({
            id: 'staff-1',
            email: 'admin@descon.com',
            role: 'admin',
            permissions: ['manage_staff_users', 'manage_candidate_documents'],
          })
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const session = await staffAuthClient.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' });

    expect(session.staffId).toBe('staff-1');
    expect(session.permissions).toEqual(['manage_staff_users', 'manage_candidate_documents']);
    expect(calls).toHaveLength(2);
    const [loginUrl, loginInit] = calls[0];
    expect(loginUrl).toContain('/auth/login');
    expect(JSON.parse(loginInit.body as string)).toEqual({ auth: { email: 'admin@descon.com', password: 'Passw0rd!' } });
    expect(calls[1][0]).toContain('/users/profile');
  });

  it("never accepts a mock client's credentials -- an unmocked fetch failure surfaces as a normal auth error, not a fabricated session", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;

    await expect(staffAuthClient.signIn({ email: 'admin@descon.com', password: 'Passw0rd!' })).rejects.toMatchObject({
      code: expect.stringMatching(/NETWORK_ERROR|OFFLINE/),
    });
  });
});
