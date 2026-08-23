import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { Button, CnicField, OtpField, RetryBanner, ValidationMessage, toast } from "../../design-system";
import { AUTH_ERROR_KEYS, CNIC_FIELD_ERROR_KEYS } from "../../../../shared/auth/errorMessages";
import { formatCountdown } from "../../../../shared/auth/cnicOtpFlow";
import { OTP_LENGTH } from "../../../../shared/auth/types";
import { useCnicOtpFlow } from "../../../../shared/auth/useCnicOtpFlow";
import { candidateAuthClient } from "../../lib/auth-client";

export default function LoginPage() {
  const { t } = useLanguage();
  const { login, sessionExpired, acknowledgeSessionExpired } = useAuth();
  const navigate = useNavigate();

  const onAuthenticated = useCallback(
    (session) => {
      login(session);
      navigate("/dashboard", { replace: true });
    },
    [login, navigate]
  );

  const flow = useCnicOtpFlow({ client: candidateAuthClient, onAuthenticated });
  const {
    step,
    cnic,
    cnicError,
    isSubmittingCnic,
    challenge,
    otp,
    otpError,
    isSubmittingOtp,
    isResending,
    secondsUntilExpiry,
    secondsUntilResendAvailable,
    setCnic,
    submitCnic,
    setOtp,
    submitOtp,
    resendOtp,
    backToCnic,
  } = flow;

  useEffect(() => {
    if (sessionExpired) {
      toast.info(t("dsSessionExpiredTitle"), { description: t("dsSessionExpiredDescription") });
      acknowledgeSessionExpired();
    }
  }, [sessionExpired, acknowledgeSessionExpired, t]);

  useEffect(() => {
    if (challenge) {
      toast.success(t("authOtpSentToastMessage"));
    }
    // Only re-fire when a *new* challenge is issued (initial send or resend), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.challengeId]);

  const isExpired = otpError?.code === "OTP_EXPIRED" || secondsUntilExpiry === 0;
  const isLockedOut = otpError?.code === "OTP_MAX_ATTEMPTS";
  const otpFieldDisabled = isSubmittingOtp || isExpired || isLockedOut;

  const genericOtpErrorMessage =
    otpError && !isExpired && !isLockedOut
      ? otpError.code === "RESEND_COOLDOWN" && typeof otpError.retryAfterSeconds === "number"
        ? `${t("authResendAvailableInPrefix")} ${formatCountdown(otpError.retryAfterSeconds)}`
        : t(AUTH_ERROR_KEYS[otpError.code])
      : null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 pb-8 pt-16">
        <div className="mb-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === "otp" ? backToCnic() : navigate("/"))}
            className="text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            {t("back")}
          </button>
        </div>

        <div className="mb-10">
          <h1 className="mb-2 text-3xl font-semibold text-text-primary">
            {step === "cnic" ? t("login") : t("verifyOTP")}
          </h1>
          <p className="text-base leading-7 text-text-secondary">
            {step === "cnic"
              ? t("loginMessage")
              : `${t("otpSentMessage")}${challenge?.maskedDestination ? ` ${challenge.maskedDestination}` : ""}`}
          </p>
        </div>

        {step === "cnic" ? (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              submitCnic();
            }}
          >
            <CnicField
              label={t("cnic")}
              placeholder={t("enterCNIC")}
              value={cnic}
              onValueChange={setCnic}
              errorMessage={cnicError ? t(CNIC_FIELD_ERROR_KEYS[cnicError]) : undefined}
              disabled={isSubmittingCnic}
              autoFocus
            />
            {!cnicError && otpError ? <ValidationMessage tone="error">{t(AUTH_ERROR_KEYS[otpError.code])}</ValidationMessage> : null}
            <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmittingCnic}>
              {t("sendOTP")}
            </Button>
          </form>
        ) : (
          <div className="space-y-5">
            <OtpField
              label={t("enterOTP")}
              value={otp}
              onValueChange={setOtp}
              onComplete={(code) => submitOtp(code)}
              disabled={otpFieldDisabled}
              errorMessage={genericOtpErrorMessage ?? undefined}
              autoFocus
            />

            {!isExpired && !isLockedOut ? (
              <p className="text-sm text-text-secondary">
                {t("authCodeExpiresInPrefix")} {formatCountdown(secondsUntilExpiry ?? 0)}
              </p>
            ) : null}

            {isExpired ? (
              <RetryBanner
                message={t("authOtpExpiredDescription")}
                retryLabel={t("resendOTP")}
                onRetry={resendOtp}
              />
            ) : null}
            {isLockedOut ? (
              <RetryBanner
                message={t("authOtpMaxAttemptsDescription")}
                retryLabel={t("resendOTP")}
                onRetry={resendOtp}
              />
            ) : null}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmittingOtp}
              disabled={otpFieldDisabled || otp.length !== OTP_LENGTH}
              onClick={() => submitOtp()}
            >
              {t("verifyAndLogin")}
            </Button>

            {!isExpired && !isLockedOut ? (
              secondsUntilResendAvailable > 0 ? (
                <p className="text-center text-sm text-text-secondary">
                  {t("authResendAvailableInPrefix")} {formatCountdown(secondsUntilResendAvailable)}
                </p>
              ) : (
                <Button variant="outline" size="lg" fullWidth loading={isResending} onClick={resendOtp}>
                  {t("resendOTP")}
                </Button>
              )
            ) : null}

            <Button variant="text" size="sm" fullWidth onClick={backToCnic}>
              {t("authChangeCnic")}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
