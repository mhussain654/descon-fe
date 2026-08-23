import '@testing-library/jest-dom';

// jsdom doesn't implement elementFromPoint; input-otp's password-manager-badge
// detection (OtpField's underlying dependency) polls it on a timer regardless
// of whether a test is still running, which otherwise surfaces as an unhandled
// rejection after the owning test has already finished.
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}