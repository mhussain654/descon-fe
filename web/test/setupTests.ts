import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// MPS-F901: adds `expect(container).toHaveNoViolations()` for the automated half of the
// accessibility audit (axe-core under the hood). jest-axe (not the still-pre-release
// vitest-axe) works fine here since Vitest's `expect` is Jest-API-compatible with
// `globals: true` (vitest.config.ts) -- no separate Vitest-specific package needed.
expect.extend(toHaveNoViolations);

// jsdom doesn't implement elementFromPoint; input-otp's password-manager-badge
// detection (OtpField's underlying dependency) polls it on a timer regardless
// of whether a test is still running, which otherwise surfaces as an unhandled
// rejection after the owning test has already finished.
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// jsdom doesn't implement ResizeObserver either; recharts' ResponsiveContainer
// (web/src/client-integrations/recharts.jsx, first used in the admin portal's
// Phase 1 dashboard charts) reads it unconditionally on mount. A no-op stub is
// all tests need -- they assert on the chart's data/markup, never on real
// resize behavior, which jsdom can't produce anyway.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}