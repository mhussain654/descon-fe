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
  });
  initialized = true;
}

export function reportError(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}
