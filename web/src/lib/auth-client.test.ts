import { afterEach, describe, expect, it } from 'vitest';
import { candidateAuthClient } from './auth-client';

function successEnvelope(data: unknown) {
  return { data, meta: {}, errors: [] };
}

describe('candidateAuthClient (web)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
  });

  it('is wired to the real backend -- posts to /candidate/auth/otp/request, not a mock', async () => {
    const calls: Array<[string, RequestInit]> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify(successEnvelope({ expires_in_seconds: 300, resend_after_seconds: 60 })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await candidateAuthClient.requestOtp('1234512345671');

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toContain('/candidate/auth/otp/request');
    expect(JSON.parse(init.body as string)).toEqual({ candidate: { cnic: '1234512345671' } });
  });

  it('sends the current persisted language as X-Locale', async () => {
    window.localStorage.setItem('descon.language', 'ur');
    const calls: RequestInit[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(JSON.stringify(successEnvelope({ expires_in_seconds: 300, resend_after_seconds: 60 })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await candidateAuthClient.requestOtp('1234512345671');

    const headers = calls[0].headers as Record<string, string>;
    expect(headers['X-Locale']).toBe('ur');
  });

  it("never accepts the mock client's well-known OTP -- an unmocked fetch failure surfaces as a normal auth error, not a fabricated session", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    await expect(candidateAuthClient.verifyOtp('1234512345671', '123456')).rejects.toMatchObject({
      code: expect.stringMatching(/NETWORK_ERROR|OFFLINE/),
    });
  });
});
