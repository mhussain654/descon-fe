// Framework-agnostic on purpose: this file runs under both web's Vitest and
// mobile's Jest (see each app's test config) to prove the shared client
// behaves identically in a browser-like (jsdom) and React Native (jest-expo)
// test environment. It relies only on the `describe`/`it`/`expect`/`afterEach`
// globals both runners inject -- no `vitest`-only APIs (`vi.*`).
import { createApiClient } from './api-client';

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

function errorEnvelope(
  errors: Array<{ code: string; message: string; field?: string }>,
  requestId = 'a9fe75dc-5233-4ca2-bf76-45745af67d6d'
) {
  return { errors, request_id: requestId };
}

describe('api-client', () => {
  it('resolves with parsed JSON on success when the body is not wrapped in an envelope', async () => {
    stubFetch(async () => jsonResponse({ hello: 'world' }));
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.get('/ping')).resolves.toEqual({ hello: 'world' });
  });

  it('unwraps the Rails SuccessEnvelope, returning only `data` (see openapi.yaml: every 2xx response is `{ data, meta, errors: [] }`)', async () => {
    stubFetch(async () =>
      jsonResponse({
        data: { expires_in_seconds: 300, resend_after_seconds: 60 },
        meta: { request_id: 'a9fe75dc-5233-4ca2-bf76-45745af67d6d', timestamp: '2026-08-23T09:00:08Z' },
        errors: [],
      })
    );
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.post('/candidate/auth/otp/request')).resolves.toEqual({
      expires_in_seconds: 300,
      resend_after_seconds: 60,
    });
  });

  it('resolves with undefined for a 204 response', async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.del('/thing/1')).resolves.toBeUndefined();
  });

  it('normalizes a network failure as NETWORK_ERROR when online', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = createApiClient({ baseUrl: 'http://example.test', isOnline: () => true });
    await expect(client.get('/ping')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('normalizes a network failure as OFFLINE when connectivity is known to be down', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = createApiClient({ baseUrl: 'http://example.test', isOnline: () => false });
    await expect(client.get('/ping')).rejects.toMatchObject({ status: 0, code: 'OFFLINE' });
  });

  it('parses the Rails ErrorEnvelope on a 4xx response', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'candidate_not_found', message: 'Candidate not found' }]), {
        status: 404,
        statusText: 'Not Found',
      })
    );
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.get('/candidates/999')).rejects.toMatchObject({
      status: 404,
      code: 'HTTP_4XX',
      serverCode: 'candidate_not_found',
      message: 'Candidate not found',
      requestId: 'a9fe75dc-5233-4ca2-bf76-45745af67d6d',
    });
  });

  it('surfaces the field on a validation error item', async () => {
    stubFetch(async () =>
      jsonResponse(
        errorEnvelope([{ code: 'invalid_format', message: 'CNIC format is invalid', field: 'cnic' }]),
        { status: 422 }
      )
    );
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.post('/candidates', {})).rejects.toMatchObject({
      code: 'HTTP_4XX',
      serverCode: 'invalid_format',
      field: 'cnic',
    });
  });

  it('parses retryAfterSeconds from a Retry-After header on a 429 response', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
      })
    );
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.post('/candidate/auth/otp/request', {})).rejects.toMatchObject({
      status: 429,
      serverCode: 'rate_limited',
      retryAfterSeconds: 30,
    });
  });

  it('leaves retryAfterSeconds undefined when no Retry-After header is present', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'candidate_not_found', message: 'Candidate not found' }]), {
        status: 404,
      })
    );
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.get('/candidates/999')).rejects.toMatchObject({ retryAfterSeconds: undefined });
  });

  it('classifies 5xx responses as HTTP_5XX without inventing an English message', async () => {
    stubFetch(
      async () => new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
    );
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.get('/candidates')).rejects.toMatchObject({ status: 500, code: 'HTTP_5XX' });
    await expect(client.get('/candidates')).rejects.not.toHaveProperty('message');
  });

  it('normalizes an unparseable JSON body as PARSE_ERROR', async () => {
    stubFetch(async () => new Response('not json', { status: 200 }));
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await expect(client.get('/ping')).rejects.toMatchObject({ code: 'PARSE_ERROR' });
  });

  it('sends a JSON content-type and body for requests with a payload', async () => {
    const calls: Array<[string, RequestInit]> = [];
    stubFetch(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return jsonResponse({ ok: true });
    });
    const client = createApiClient({ baseUrl: 'http://example.test' });
    await client.post('/candidates', { full_name: 'Test' });

    const [, requestInit] = calls[0];
    expect(requestInit.method).toBe('POST');
    expect((requestInit.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(requestInit.body as string)).toEqual({ full_name: 'Test' });
  });

  it('classifies an expired request timeout as TIMEOUT, not CANCELLED', async () => {
    stubFetch(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }) as Promise<Response>
    );
    const client = createApiClient({ baseUrl: 'http://example.test', timeoutMs: 5 });
    await expect(client.get('/slow')).rejects.toMatchObject({ status: 0, code: 'TIMEOUT' });
  });

  it('classifies caller-initiated cancellation as CANCELLED, not TIMEOUT', async () => {
    stubFetch(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }) as Promise<Response>
    );
    const client = createApiClient({ baseUrl: 'http://example.test', timeoutMs: 60_000 });
    const controller = new AbortController();
    const pending = client.get('/slow', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 0, code: 'CANCELLED' });
  });

  it('removes the caller abort listener after the request settles', async () => {
    stubFetch(async () => jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl: 'http://example.test' });
    const controller = new AbortController();
    const removedEvents: string[] = [];
    const originalRemove = controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.removeEventListener = (type: string, ...rest: unknown[]) => {
      removedEvents.push(type);
      return (originalRemove as (...args: unknown[]) => void)(type, ...rest);
    };

    await client.get('/ping', { signal: controller.signal });

    expect(removedEvents).toContain('abort');
  });

  describe('getWithMeta', () => {
    it('surfaces the envelope meta alongside data, unlike get() which discards it', async () => {
      stubFetch(async () =>
        jsonResponse({
          data: [{ id: '1' }],
          meta: { pagination: { page: 1, per_page: 20, total_count: 1, total_pages: 1 }, request_id: 'r1' },
          errors: [],
        })
      );
      const client = createApiClient({ baseUrl: 'http://example.test' });
      await expect(client.getWithMeta('/things')).resolves.toEqual({
        data: [{ id: '1' }],
        meta: { pagination: { page: 1, per_page: 20, total_count: 1, total_pages: 1 }, request_id: 'r1' },
      });
    });

    it('leaves meta undefined for a bare, unwrapped body', async () => {
      stubFetch(async () => jsonResponse({ hello: 'world' }));
      const client = createApiClient({ baseUrl: 'http://example.test' });
      await expect(client.getWithMeta('/ping')).resolves.toEqual({ data: { hello: 'world' }, meta: undefined });
    });

    it('resolves with undefined data and meta for a 204 response', async () => {
      stubFetch(async () => new Response(null, { status: 204 }));
      const client = createApiClient({ baseUrl: 'http://example.test' });
      await expect(client.getWithMeta('/things/1')).resolves.toEqual({ data: undefined, meta: undefined });
    });

    it('still throws the normalized ApiError on a 4xx response', async () => {
      stubFetch(async () =>
        jsonResponse(errorEnvelope([{ code: 'invalid_query_parameter', message: 'Invalid filter' }]), {
          status: 400,
        })
      );
      const client = createApiClient({ baseUrl: 'http://example.test' });
      await expect(client.getWithMeta('/things')).rejects.toMatchObject({
        status: 400,
        serverCode: 'invalid_query_parameter',
      });
    });
  });
});
