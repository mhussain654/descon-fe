const mockGetCachedLanguage = jest.fn(() => 'en');
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
}));
jest.mock('../contexts/LanguageContext', () => ({
  getCachedLanguage: () => mockGetCachedLanguage(),
}));

import { candidateAuthClient } from './auth-client';

describe('candidateAuthClient (mobile)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockGetCachedLanguage.mockReset().mockReturnValue('en');
  });

  it('is wired to the real backend -- posts to /candidate/auth/otp/request, not a mock', async () => {
    const calls: Array<[string, RequestInit]> = [];
    globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(
        JSON.stringify({
          data: { expires_in_seconds: 300, resend_after_seconds: 60 },
          meta: {},
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as typeof fetch;

    await candidateAuthClient.requestOtp('4210112345671');

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toContain('/candidate/auth/otp/request');
    expect(JSON.parse(init.body as string)).toEqual({ candidate: { cnic: '4210112345671' } });
  });

  it('sends the current cached language as X-Locale', async () => {
    mockGetCachedLanguage.mockReturnValue('ur');
    const calls: RequestInit[] = [];
    globalThis.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(
        JSON.stringify({
          data: { expires_in_seconds: 300, resend_after_seconds: 60 },
          meta: {},
          errors: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as typeof fetch;

    await candidateAuthClient.requestOtp('4210112345671');

    const headers = calls[0].headers as Record<string, string>;
    expect(headers['X-Locale']).toBe('ur');
  });

  it("never accepts the mock client's well-known OTP -- an unmocked fetch failure surfaces as a normal auth error, not a fabricated session", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;

    await expect(candidateAuthClient.verifyOtp('4210112345671', '123456')).rejects.toMatchObject({
      code: expect.stringMatching(/NETWORK_ERROR|OFFLINE/),
    });
  });
});
