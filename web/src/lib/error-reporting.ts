import * as Sentry from '@sentry/react';

// MPS-F902 -- @sentry/react wiring for the web client, gated on VITE_SENTRY_DSN
// being provided, mirroring the backend's ENV['SENTRY_DSN']-gated pattern
// (descon-be/config/initializers/sentry.rb): a no-op in dev/test/any
// environment without a real DSN, real error reporting once one is
// provisioned. Client-side only -- initErrorReporting() must never run
// during SSR (Sentry's browser SDK assumes a `window`/`document`), so its
// only call site (root.tsx's <ClientOnly> loader) is already gated that way.
//
// Confirmed via a real `npm run build`: with no VITE_SENTRY_DSN set, Vite
// statically inlines `import.meta.env.VITE_SENTRY_DSN` as `undefined`, so
// Rollup's dead-code elimination proves the body of both functions below is
// unreachable and strips all @sentry/react code from the production client
// bundle entirely (verified: zero bytes of bundle-size cost when
// unconfigured, byte-identical output to a build with this file absent).
// Setting VITE_SENTRY_DSN restores the real Sentry.init/captureException
// calls in the bundle, also verified directly against the build output.
let initialized = false;

// `sendDefaultPii: false` only stops Sentry from *automatically* attaching
// IP/cookies/headers -- it does nothing about a sensitive value that ends up
// embedded in an exception's own message/stack, a breadcrumb, or custom
// context (e.g. a bug that does `throw new Error(\`Failed for CNIC ${cnic}\`)`,
// or a breadcrumb capturing a request URL that happened to carry a token in
// its query string). This is the same sensitive-field list as the backend's
// initializer (descon-be/config/initializers/sentry.rb), applied more
// broadly: exception values, breadcrumbs, and request URLs, not just the
// top-level event message.
const SENSITIVE_KEY_VALUE_PATTERN =
  /\b(cnic|passport|otp|password|token|account_number|iban|signature)\b"?\s*[:=]\s*"?[^\s&,;"'}]*/gi;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const CNIC_PATTERN = /\b\d{5}-?\d{7}-?\d\b/g;

/** Redacts known-sensitive substrings from free text before it ever leaves the process. Exported for direct testing. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(SENSITIVE_KEY_VALUE_PATTERN, (_match, key: string) => `${key}=[REDACTED]`)
    .replace(JWT_PATTERN, '[REDACTED]')
    .replace(CNIC_PATTERN, '[REDACTED]');
}

/**
 * Our own API clients all reject with a `{ code, message?, ... }`-shaped
 * error for every expected condition (validation failures, session expiry,
 * rate limiting, offline, etc. -- see e.g. shared/auth/errorMessages.ts and
 * every sibling *ErrorCode type in shared/). Those are handled outcomes the
 * UI already renders a state for, not bugs -- reporting them to Sentry would
 * just be noise (and a vector for whatever the error's own message/context
 * happens to carry). Only genuinely unexpected exceptions (thrown into
 * root.tsx's error boundary) should ever reach `reportError` in the first
 * place, but this is a second line of defense against a future call site
 * passing one of these through.
 */
function isExpectedApiError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string';
}

function redactBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  const redacted = { ...breadcrumb };
  if (typeof redacted.message === 'string') redacted.message = redactSensitiveText(redacted.message);
  if (redacted.data && typeof redacted.data.url === 'string') {
    redacted.data = { ...redacted.data, url: redactSensitiveText(redacted.data.url) };
  }
  return redacted;
}

export function initErrorReporting(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number((import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined) ?? 0.1),
    // AGENTS.md: "Do not log tokens, OTPs, complete CNICs, passport numbers,
    // bank details, documents or sensitive API payloads" -- request/response
    // bodies and headers can carry any of those, so never let Sentry attach
    // them automatically.
    sendDefaultPii: false,
    beforeBreadcrumb: redactBreadcrumb,
    beforeSend(event, hint) {
      if (isExpectedApiError(hint?.originalException)) return null;

      if (typeof event.message === 'string') event.message = redactSensitiveText(event.message);
      event.exception?.values?.forEach((exceptionValue) => {
        if (typeof exceptionValue.value === 'string') exceptionValue.value = redactSensitiveText(exceptionValue.value);
      });
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        if (typeof event.request.url === 'string') event.request.url = redactSensitiveText(event.request.url);
      }
      return event;
    },
  });
  initialized = true;
}

export function reportError(error: unknown): void {
  if (!initialized || isExpectedApiError(error)) return;
  Sentry.captureException(error);
}
