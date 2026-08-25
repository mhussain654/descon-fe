import { useCallback, useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import {
  Button,
  CnicField,
  OtpField,
  RetryBanner,
  ValidationMessage,
  toast,
} from "../design-system";
import { colors, fontWeights, spacing } from "../design-system/tokens";
import { AUTH_ERROR_KEYS, CNIC_FIELD_ERROR_KEYS } from "../../../shared/auth/errorMessages";
import { formatCountdown } from "../../../shared/auth/cnicOtpFlow";
import { OTP_LENGTH } from "../../../shared/auth/types";
import { useCnicOtpFlow } from "../../../shared/auth/useCnicOtpFlow";
import { candidateAuthClient } from "../lib/auth-client";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { login, sessionExpired, acknowledgeSessionExpired } = useAuth();

  const onAuthenticated = useCallback(
    async (session) => {
      try {
        await login(session);
      } catch {
        toast.error(t("authSessionPersistError"));
        return;
      }
      router.replace("/(tabs)/dashboard");
    },
    [login, router, t]
  );

  const flow = useCnicOtpFlow({ client: candidateAuthClient, onAuthenticated });
  const {
    step,
    cnic,
    cnicError,
    isSubmittingCnic,
    challenge,
    issuedAt,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuedAt]);

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
    <KeyboardAvoidingAnimatedView style={styles.screen} behavior="padding">
      <StatusBar style="dark" />

      {/* Small phones, landscape orientation and larger font scales can push
          this content taller than the viewport -- a ScrollView (rather than
          the previous fixed View) keeps the OTP field and Verify button
          reachable instead of clipping them off-screen. */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + spacing[6] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => (step === "otp" ? backToCnic() : router.back())}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{t("back")}</Text>
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{step === "cnic" ? t("login") : t("verifyOTP")}</Text>
          <Text style={styles.message}>
            {step === "cnic"
              ? t("loginMessage")
              : `${t("otpSentMessage")}${challenge?.maskedDestination ? ` ${challenge.maskedDestination}` : ""}`}
          </Text>
        </View>

        {step === "cnic" ? (
          <View style={styles.fieldStack}>
            <CnicField
              label={t("cnic")}
              placeholder={t("enterCNIC")}
              value={cnic}
              onValueChange={setCnic}
              errorMessage={cnicError ? t(CNIC_FIELD_ERROR_KEYS[cnicError]) : undefined}
              editable={!isSubmittingCnic}
              autoFocus
            />
            {!cnicError && otpError ? (
              <ValidationMessage tone="error">{t(AUTH_ERROR_KEYS[otpError.code])}</ValidationMessage>
            ) : null}
            <Button variant="primary" size="lg" fullWidth loading={isSubmittingCnic} onPress={submitCnic}>
              {t("sendOTP")}
            </Button>
          </View>
        ) : (
          <View style={styles.fieldStack}>
            <OtpField
              label={t("enterOTP")}
              value={otp}
              onValueChange={setOtp}
              onComplete={(code) => submitOtp(code)}
              editable={!otpFieldDisabled}
              errorMessage={genericOtpErrorMessage ?? undefined}
              autoFocus
            />

            {!isExpired && !isLockedOut ? (
              <Text style={styles.countdown}>
                {t("authCodeExpiresInPrefix")} {formatCountdown(secondsUntilExpiry ?? 0)}
              </Text>
            ) : null}

            {isExpired ? (
              <RetryBanner message={t("authOtpExpiredDescription")} retryLabel={t("resendOTP")} onRetry={resendOtp} />
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
              onPress={() => submitOtp()}
            >
              {t("verifyAndLogin")}
            </Button>

            {!isExpired && !isLockedOut ? (
              secondsUntilResendAvailable > 0 ? (
                <Text style={styles.resendCountdown}>
                  {t("authResendAvailableInPrefix")} {formatCountdown(secondsUntilResendAvailable)}
                </Text>
              ) : (
                <Button variant="outline" size="lg" fullWidth loading={isResending} onPress={resendOtp}>
                  {t("resendOTP")}
                </Button>
              )
            ) : null}

            <Button variant="text" size="sm" fullWidth onPress={backToCnic}>
              {t("authChangeCnic")}
            </Button>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingAnimatedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.raised },
  content: { flexGrow: 1, paddingHorizontal: spacing[6] },
  backButton: { marginBottom: spacing[10] },
  backText: { fontSize: 14, fontWeight: fontWeights.medium, color: colors.text.secondary },
  titleBlock: { marginBottom: spacing[10] },
  title: { fontSize: 28, fontWeight: fontWeights.semibold, color: colors.text.primary, marginBottom: spacing[2] },
  message: { fontSize: 16, color: colors.text.secondary, lineHeight: 22 },
  fieldStack: { gap: spacing[5] },
  countdown: { fontSize: 14, color: colors.text.secondary },
  resendCountdown: { fontSize: 14, color: colors.text.secondary, textAlign: "center" },
});
