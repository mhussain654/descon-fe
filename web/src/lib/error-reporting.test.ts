import { afterEach, describe, expect, it, vi } from 'vitest';

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
});
