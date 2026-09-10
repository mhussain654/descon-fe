import { afterEach, describe, expect, it, vi } from 'vitest';
import { redactSensitiveText } from './error-reporting';

const sentryInit = vi.fn();
const sentryCaptureException = vi.fn();

vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => sentryInit(...args),
  captureException: (...args: unknown[]) => sentryCaptureException(...args),
}));

// Each test imports a fresh module instance (vi.resetModules) since
// initErrorReporting's `initialized` guard is module-level state -- without
// this, whichever test runs first would decide it for every test after.
async function freshErrorReportingModule() {
  vi.resetModules();
  return import('./error-reporting');
}

afterEach(() => {
  sentryInit.mockClear();
  sentryCaptureException.mockClear();
  vi.unstubAllEnvs();
});

describe('error-reporting', () => {
  it('never calls Sentry.init when VITE_SENTRY_DSN is not set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const { initErrorReporting } = await freshErrorReportingModule();

    initErrorReporting();

    expect(sentryInit).not.toHaveBeenCalled();
  });

  it('calls Sentry.init with a PII-safe config once VITE_SENTRY_DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const { initErrorReporting } = await freshErrorReportingModule();

    initErrorReporting();

    expect(sentryInit).toHaveBeenCalledTimes(1);
    const [config] = sentryInit.mock.calls[0];
    expect(config.dsn).toBe('https://examplePublicKey@o0.ingest.sentry.io/0');
    expect(config.sendDefaultPii).toBe(false);
  });

  it('does not re-initialize on a second call', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const { initErrorReporting } = await freshErrorReportingModule();

    initErrorReporting();
    initErrorReporting();

    expect(sentryInit).toHaveBeenCalledTimes(1);
  });

  it('reportError is a no-op before initErrorReporting has run', async () => {
    const { reportError } = await freshErrorReportingModule();

    reportError(new Error('boom'));

    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it('reportError forwards to Sentry.captureException once initialized', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const { initErrorReporting, reportError } = await freshErrorReportingModule();
    initErrorReporting();

    const error = new Error('boom');
    reportError(error);

    expect(sentryCaptureException).toHaveBeenCalledWith(error);
  });

  it('never reports an expected API error (shaped { code, ... }) to Sentry', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const { initErrorReporting, reportError } = await freshErrorReportingModule();
    initErrorReporting();

    reportError({ code: 'SESSION_EXPIRED', message: 'Session expired' });

    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  describe('redactSensitiveText', () => {
    it('redacts a key=value pair for a sensitive field name', () => {
      expect(redactSensitiveText('Failed request: token=abc.def.ghi')).toBe('Failed request: token=[REDACTED]');
    });

    it('redacts a key: value pair (JSON-ish) for a sensitive field name', () => {
      expect(redactSensitiveText('{"password": "hunter2"}')).toContain('password=[REDACTED]');
    });

    it('redacts a bare JWT-shaped string even without a labeled key', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGhpc2lzYXNpZ25hdHVyZQ';
      expect(redactSensitiveText(`Bearer ${jwt} rejected`)).toBe('Bearer [REDACTED] rejected');
    });

    it('redacts a bare CNIC-shaped number', () => {
      expect(redactSensitiveText('Lookup failed for 42101-1234567-1')).toBe('Lookup failed for [REDACTED]');
    });

    it('redacts an unformatted 13-digit CNIC', () => {
      expect(redactSensitiveText('cnic 4210112345671 not found')).toBe('cnic [REDACTED] not found');
    });

    it('leaves ordinary, non-sensitive text untouched', () => {
      expect(redactSensitiveText('Failed to fetch /api/v1/candidates')).toBe('Failed to fetch /api/v1/candidates');
    });
  });

  describe('Sentry.init redaction hooks', () => {
    async function initAndGetConfig() {
      vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
      const { initErrorReporting } = await freshErrorReportingModule();
      initErrorReporting();
      return sentryInit.mock.calls[0][0];
    }

    it('redacts the top-level event message in beforeSend', async () => {
      const config = await initAndGetConfig();

      const result = config.beforeSend({ message: 'Login failed for cnic=42101-1234567-1' }, {});

      expect(result.message).toBe('Login failed for cnic=[REDACTED]');
    });

    it('redacts each exception value in beforeSend', async () => {
      const config = await initAndGetConfig();

      const result = config.beforeSend(
        { exception: { values: [{ value: 'otp=123456 invalid' }, { value: 'unrelated crash' }] } },
        {}
      );

      expect(result.exception.values[0].value).toBe('otp=[REDACTED] invalid');
      expect(result.exception.values[1].value).toBe('unrelated crash');
    });

    it('strips request cookies/headers and redacts the request URL in beforeSend', async () => {
      const config = await initAndGetConfig();

      const result = config.beforeSend(
        {
          request: {
            url: 'https://api.example.com/x?token=abc123',
            cookies: { session: 'abc' },
            headers: { Authorization: 'Bearer abc' },
          },
        },
        {}
      );

      expect(result.request.cookies).toBeUndefined();
      expect(result.request.headers).toBeUndefined();
      expect(result.request.url).toBe('https://api.example.com/x?token=[REDACTED]');
    });

    it('drops the event entirely (returns null) when the original exception is an expected API error', async () => {
      const config = await initAndGetConfig();

      const result = config.beforeSend({ message: 'boom' }, { originalException: { code: 'VALIDATION_ERROR' } });

      expect(result).toBeNull();
    });

    it('redacts a breadcrumb message in beforeBreadcrumb', async () => {
      const config = await initAndGetConfig();

      const result = config.beforeBreadcrumb({ message: 'Request failed with password=hunter2' });

      expect(result.message).toBe('Request failed with password=[REDACTED]');
    });

    it('redacts a breadcrumb\'s request URL in beforeBreadcrumb', async () => {
      const config = await initAndGetConfig();

      const result = config.beforeBreadcrumb({ data: { url: 'https://api.example.com/x?signature=abc123', method: 'GET' } });

      expect(result.data.url).toBe('https://api.example.com/x?signature=[REDACTED]');
      expect(result.data.method).toBe('GET');
    });
  });
});
