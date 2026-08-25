// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { createApiClient } from '../api-client';
import { createCandidateAuthClient } from './realCandidateAuthClient';

const originalFetch = globalThis.fetch;

function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

const CNIC = '4210112345671';

function buildClient(getLocale: () => 'en' | 'ur' = () => 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createCandidateAuthClient({ apiClient, getLocale });
}

describe('createCandidateAuthClient (real)', () => {
  it('requestOtp posts the CNIC and returns the server-declared timings', async () => {
    const fetchCalls: Array<[string, RequestInit]> = [];
    stubFetch(async (url, init) => {
      fetchCalls.push([String(url), init as RequestInit]);
      return jsonResponse({ expires_in_seconds: 300, resend_after_seconds: 60 });
    });

    const client = buildClient();
    const challenge = await client.requestOtp(CNIC);

    expect(challenge).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 60 });
    const [url, init] = fetchCalls[0];
    expect(url).toBe('http://example.test/api/v1/candidate/auth/otp/request');
    expect(JSON.parse(init.body as string)).toEqual({ candidate: { cnic: CNIC } });
  });

  it('sends the current locale via X-Locale on every request', async () => {
    const fetchCalls: Array<RequestInit> = [];
    stubFetch(async (_url, init) => {
      fetchCalls.push(init as RequestInit);
      return jsonResponse({ expires_in_seconds: 300, resend_after_seconds: 60 });
    });

    const client = buildClient(() => 'ur');
    await client.requestOtp(CNIC);

    const headers = fetchCalls[0].headers as Record<string, string>;
    expect(headers['X-Locale']).toBe('ur');
  });

  it('resendOtp calls the same request endpoint again -- there is no separate resend endpoint', async () => {
    const fetchCalls: string[] = [];
    stubFetch(async (url) => {
      fetchCalls.push(String(url));
      return jsonResponse({ expires_in_seconds: 300, resend_after_seconds: 60 });
    });

    const client = buildClient();
    await client.resendOtp(CNIC);

    expect(fetchCalls).toEqual(['http://example.test/api/v1/candidate/auth/otp/request']);
  });

  it('verifyOtp posts the CNIC and code, returning a full session', async () => {
    stubFetch(async () =>
      jsonResponse(
        {
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          token_type: 'Bearer',
          expires_in: 900,
          session: { id: 'session-1' },
          candidate: { id: 'candidate-1', full_name: 'Ahmed Ali', preferred_locale: 'en' },
        },
        { status: 201 }
      )
    );

    const client = buildClient();
    const before = Date.now();
    const session = await client.verifyOtp(CNIC, '123456');

    expect(session.accessToken).toBe('access-1');
    expect(session.refreshToken).toBe('refresh-1');
    expect(session.candidateId).toBe('candidate-1');
    expect(session.candidateName).toBe('Ahmed Ali');
    expect(session.preferredLocale).toBe('en');
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThanOrEqual(before + 900 * 1000);
  });

  it('maps otp_invalid to OTP_INVALID', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'otp_invalid', message: 'The verification code is incorrect.' }]), {
        status: 401,
      })
    );
    const client = buildClient();
    await expect(client.verifyOtp(CNIC, '000000')).rejects.toEqual({ code: 'OTP_INVALID' });
  });

  it('maps otp_expired to OTP_EXPIRED', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'otp_expired', message: 'This code has expired.' }]), { status: 401 })
    );
    const client = buildClient();
    await expect(client.verifyOtp(CNIC, '000000')).rejects.toEqual({ code: 'OTP_EXPIRED' });
  });

  it('maps otp_max_attempts to OTP_MAX_ATTEMPTS', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'otp_max_attempts', message: 'Too many attempts.' }]), { status: 401 })
    );
    const client = buildClient();
    await expect(client.verifyOtp(CNIC, '000000')).rejects.toEqual({ code: 'OTP_MAX_ATTEMPTS' });
  });

  it('maps a 429 with Retry-After to RATE_LIMITED with the seconds to wait', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '45' },
      })
    );
    const client = buildClient();
    await expect(client.requestOtp(CNIC)).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 45 });
  });

  it('maps a validation (422) failure to the generic, non-enumerating OTP_REQUEST_FAILED', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'validation_failed', message: 'Enter a valid CNIC.', field: 'cnic' }]), {
        status: 422,
      })
    );
    const client = buildClient();
    await expect(client.requestOtp(CNIC)).rejects.toEqual({ code: 'OTP_REQUEST_FAILED' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = buildClient();
    await expect(client.requestOtp(CNIC)).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });

  it('maps an offline failure to OFFLINE', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1', isOnline: () => false });
    const client = createCandidateAuthClient({ apiClient, getLocale: () => 'en' });
    await expect(client.requestOtp(CNIC)).rejects.toEqual({ code: 'OFFLINE' });
  });

  it('maps an unparseable/unexpected success body to UNKNOWN rather than throwing', async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    const client = buildClient();
    await expect(client.requestOtp(CNIC)).rejects.toEqual({ code: 'UNKNOWN' });
  });
});
