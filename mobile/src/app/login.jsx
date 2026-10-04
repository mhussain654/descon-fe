import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Clock, IdCard } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { RequireGuest } from "../features/auth/RequireGuest";
import { RegistrationGuidance } from "../features/onboarding/RegistrationGuidance";
import { BrandHeader } from "../features/onboarding/BrandHeader";
import { SecureFooter } from "../features/onboarding/SecureFooter";
import { BackArrow, forwardArrowSlots } from "../features/onboarding/directionalArrows";
import { isStartSide, physicalTextAlign } from "../lib/layoutDirection";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import {
  Button,
  CnicField,
  OfflineState,
  OtpField,
  RetryBanner,
  ValidationMessage,
  toast,
  getFontFamily,
} from "../design-system";
import { colors, elevation, fontWeights, radii, spacing } from "../design-system/tokens";
import { AUTH_ERROR_KEYS, CNIC_FIELD_ERROR_KEYS } from "../../../shared/auth/errorMessages";
import { formatCountdown, withCountdown } from "../../../shared/auth/cnicOtpFlow";
import { OTP_LENGTH } from "../../../shared/auth/types";
import { useCnicOtpFlow } from "../../../shared/auth/useCnicOtpFlow";
import { candidateAuthClient } from "../lib/auth-client";

// The worker/globe photo leaves its open, shaded sky on one side for the copy:
// left in English, and in the mirrored Urdu copy on the right.
const HERO_PHOTO = {
  en: require("../../assets/images/login-hero.webp"),
  ur: require("../../assets/images/login-hero-rtl.webp"),
};
// The sheet's rounded top slides up over the base of the photo.
const SHEET_OVERLAP = 28;
const HERO_SHADE_COLOR = "#00379A";

// Dark-blue shade over the photo's copy side (fading out toward the worker),
// plus a soft top band behind the status bar -- what keeps the white copy
// legible over a busy photograph.
function HeroShade({ copySide }) {
  const fromLeft = copySide === "left";
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="heroShadeAcross" x1={fromLeft ? "0" : "1"} y1="0" x2={fromLeft ? "1" : "0"} y2="0">
          <Stop offset="0" stopColor={HERO_SHADE_COLOR} stopOpacity="0.93" />
          <Stop offset="0.43" stopColor={HERO_SHADE_COLOR} stopOpacity="0.73" />
          <Stop offset="0.75" stopColor={HERO_SHADE_COLOR} stopOpacity="0.12" />
          <Stop offset="1" stopColor={HERO_SHADE_COLOR} stopOpacity="0.05" />
        </LinearGradient>
        <LinearGradient id="heroShadeDown" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={HERO_SHADE_COLOR} stopOpacity="0.25" />
          <Stop offset="0.66" stopColor={HERO_SHADE_COLOR} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroShadeAcross)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroShadeDown)" />
    </Svg>
  );
}

// A row whose first child sits on the given physical side in the live layout.
function rowTowards(side) {
  return isStartSide(side) ? styles.row : styles.rowReversed;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, language, toggleLanguage } = useLanguage();
  const isUrdu = language === "ur";
  const copySide = isUrdu ? "right" : "left";
  const anchorStyle = isStartSide(copySide) ? styles.anchorStart : styles.anchorEnd;
  const copyTextStyle = { textAlign: physicalTextAlign(copySide), writingDirection: isUrdu ? "rtl" : "ltr" };
  const forwardArrow = forwardArrowSlots(language, colors.brand.on);
  const font = (weight) => ({ fontFamily: getFontFamily(language, weight) });
  const { login, sessionExpired, acknowledgeSessionExpired } = useAuth();

  const onAuthenticated = useCallback(
    async (session) => {
      try {
        await login(session);
      } catch {
        toast.error(t("authSessionPersistError"));
        return;
      }
      // MPS-204: a candidate who hasn't accepted the current policy version
      // goes straight to the consent gate, never the dashboard.
      router.replace(session.consent.accepted ? "/(tabs)/dashboard" : "/consent");
    },
    [login, router, t]
  );

  const [registrationGuidanceOpen, setRegistrationGuidanceOpen] = useState(false);
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
    rateLimitedAction,
    secondsUntilRateLimitCleared,
    setCnic,
    submitCnic,
    setOtp,
    submitOtp,
    resendOtp,
    backToCnic,
  } = flow;

  // Which OTP-step action to re-run when the candidate taps "Retry" on the
  // offline state -- otpError alone doesn't say whether verification or a
  // resend was what actually failed, and re-running the wrong one would
  // either resubmit a stale/incomplete code or silently ask for a new OTP
  // the candidate didn't ask for.
  const [lastOtpAction, setLastOtpAction] = useState("submit");
  const submitOtpAndTrack = useCallback(
    (codeOverride) => {
      setLastOtpAction("submit");
      return submitOtp(codeOverride);
    },
    [submitOtp]
  );
  const resendOtpAndTrack = useCallback(() => {
    setLastOtpAction("resend");
    return resendOtp();
  }, [resendOtp]);
  const retryOtpAction = lastOtpAction === "resend" ? resendOtpAndTrack : () => submitOtpAndTrack();

  useEffect(() => {
    setRegistrationGuidanceOpen(otpError?.code === "CNIC_NOT_FOUND");
  }, [otpError]);

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

  const isCnicOffline = cnicError === null && otpError?.code === "OFFLINE" && step === "cnic";
  const isOtpOffline = otpError?.code === "OFFLINE" && step === "otp";
  const isExpired = otpError?.code === "OTP_EXPIRED" || secondsUntilExpiry === 0;
  const isLockedOut = otpError?.code === "OTP_MAX_ATTEMPTS";
  const isCnicRateLimited = rateLimitedAction === "cnic" && (secondsUntilRateLimitCleared ?? 0) > 0;
  const isOtpRateLimited = rateLimitedAction === "otp" && (secondsUntilRateLimitCleared ?? 0) > 0;
  const isResendRateLimited = rateLimitedAction === "resend" && (secondsUntilRateLimitCleared ?? 0) > 0;
  const otpFieldDisabled = isSubmittingOtp || isExpired || isLockedOut || isOtpRateLimited;

  const genericOtpErrorMessage =
    otpError && !isExpired && !isLockedOut && !isOtpOffline
      ? otpError.code === "RESEND_COOLDOWN" && typeof otpError.retryAfterSeconds === "number"
        ? withCountdown(t("authResendAvailableIn"), otpError.retryAfterSeconds)
        : otpError.code === "RATE_LIMITED" && isResendRateLimited
          ? withCountdown(t("authResendAvailableIn"), secondsUntilRateLimitCleared ?? 0)
          : otpError.code === "RATE_LIMITED" && isOtpRateLimited
            ? withCountdown(t("authRetryAvailableIn"), secondsUntilRateLimitCleared ?? 0)
            : t(AUTH_ERROR_KEYS[otpError.code])
      : null;

  const showExpiryPill = !isExpired && !isLockedOut && !isOtpOffline;
  const expiryCountdown = formatCountdown(secondsUntilExpiry ?? 0);

  return (
    <RequireGuest>
      <KeyboardAvoidingAnimatedView style={styles.screen} behavior="padding">
        <RegistrationGuidance open={registrationGuidanceOpen} onClose={() => setRegistrationGuidanceOpen(false)} title={t("authCnicNotFoundError")} description={t("authRegistrationGuidance")} closeLabel={t("authChangeCnic")} language={language} />
      <StatusBar style="light" />

        {/* Small phones, landscape orientation and larger font scales can push
            this content taller than the viewport -- a ScrollView keeps the
            field and its action reachable instead of clipping them off-screen. */}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={[styles.hero, { paddingTop: insets.top + spacing[3], minHeight: insets.top + width * 0.98 }]}>
            <Image
              source={HERO_PHOTO[isUrdu ? "ur" : "en"]}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
            />
            <HeroShade copySide={copySide} />

            <View style={[styles.heroCopy, anchorStyle, { maxWidth: width * 0.66 }]}>
              <Pressable
                onPress={() => (step === "otp" ? backToCnic() : router.back())}
                accessibilityRole="button"
                accessibilityLabel={t("back")}
                style={[styles.backPill, rowTowards(copySide)]}
                hitSlop={8}
              >
                <BackArrow language={language} color={colors.text.inverse} />
                <Text style={[styles.backText, font("semibold")]}>{t("back")}</Text>
              </Pressable>

              <BrandHeader
                language={language}
                primary={t("brandNamePrimary")}
                secondary={t("brandNameSecondary")}
                tileAtRowStart={isStartSide(copySide)}
              />

              <Text
                accessibilityRole="header"
                style={[styles.heroTitle, isUrdu ? styles.heroTitleUrdu : null, copyTextStyle, font("bold")]}
              >
                {step === "cnic" ? t("loginHeroTitle") : t("otpHeroTitle")}
              </Text>
              <Text style={[styles.heroLead, isUrdu ? styles.heroLeadUrdu : null, copyTextStyle, font("medium")]}>
                {step === "cnic" ? t("loginHeroSubtitle") : t("otpHeroSubtitle")}
              </Text>
            </View>
          </View>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5] }]}>
            <View style={[styles.sheetHeading, rowTowards(copySide)]}>
              <View style={[styles.sheetHeadingText, isUrdu ? styles.alignEndUrdu : null]}>
                <Text style={[styles.sheetTitle, isUrdu ? styles.sheetTitleUrdu : null, copyTextStyle, font("bold")]}>
                  {step === "cnic" ? t("login") : t("otpSheetTitle")}
                </Text>
                <Text style={[styles.sheetSubtitle, isUrdu ? styles.secondaryUrdu : null, copyTextStyle, font("regular")]}>
                  {step === "cnic" ? t("loginSheetSubtitle") : t("otpSheetSubtitle")}
                </Text>
              </View>

              {step === "cnic" ? (
                // Each language names itself in its own script, so a candidate
                // who can't read the active language can still find theirs.
                <Pressable
                  onPress={toggleLanguage}
                  accessibilityRole="button"
                  accessibilityLabel={t("switchLanguage")}
                  style={styles.pill}
                >
                  <Text style={[styles.pillText, { fontFamily: getFontFamily(isUrdu ? "en" : "ur", "bold") }]}>
                    {isUrdu ? "English" : "اردو"}
                  </Text>
                </Pressable>
              ) : showExpiryPill ? (
                <View
                  accessible
                  accessibilityLabel={withCountdown(t("authCodeExpiresIn"), secondsUntilExpiry ?? 0)}
                  style={[styles.pill, styles.row]}
                >
                  <Clock size={16} color={colors.brand.default} strokeWidth={2.5} />
                  <Text style={[styles.pillText, styles.pillCountdown]}>{expiryCountdown}</Text>
                </View>
              ) : null}
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
                  leadingIcon={<IdCard size={20} color={colors.text.secondary} strokeWidth={2} />}
                  language={language}
                />
                {isCnicOffline ? (
                  <OfflineState
                    title={t("dsOfflineTitle")}
                    description={t("dsOfflineDescription")}
                    retryLabel={t("retry")}
                    onRetry={submitCnic}
                    language={language}
                  />
                ) : (
                  <>
                    {!cnicError && otpError && !registrationGuidanceOpen ? (
                      <ValidationMessage tone="error" language={language}>
                        {isCnicRateLimited
                          ? withCountdown(t("authRetryAvailableIn"), secondsUntilRateLimitCleared ?? 0)
                          : otpError.message || t(AUTH_ERROR_KEYS[otpError.code])}
                      </ValidationMessage>
                    ) : null}
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={isSubmittingCnic}
                      disabled={isCnicRateLimited}
                      onPress={submitCnic}
                      language={language}
                      labelStyle={isUrdu ? styles.buttonLabelUrdu : null}
                      style={styles.primaryButton}
                      leadingIcon={forwardArrow.leadingIcon}
                      trailingIcon={forwardArrow.trailingIcon}
                    >
                      {t("sendOTP")}
                    </Button>
                  </>
                )}
                <Text style={[styles.note, isUrdu ? styles.secondaryUrdu : null, font("regular")]}>
                  {t("loginCnicHelpNote")}
                </Text>
              </View>
            ) : (
              <View style={styles.fieldStack}>
                <View style={[styles.sentBox, rowTowards(copySide)]}>
                  <Text
                    style={[styles.sentText, isUrdu ? styles.secondaryUrdu : null, copyTextStyle, font("regular")]}
                  >
                    {challenge?.maskedDestination
                      ? `${t("otpCodeSentTo")} ${challenge.maskedDestination}`
                      : t("otpCodeSentToRegistered")}
                  </Text>
                  <Pressable onPress={backToCnic} accessibilityRole="button" hitSlop={8}>
                    <Text style={[styles.link, font("bold")]}>{t("authChangeCnic")}</Text>
                  </Pressable>
                </View>

                <View>
                  <Text style={[styles.fieldLabel, copyTextStyle, font("semibold")]}>{t("otpCodeLabel")}</Text>
                  <OtpField
                    label={t("enterOTP")}
                    value={otp}
                    onValueChange={setOtp}
                    onComplete={(code) => submitOtpAndTrack(code)}
                    editable={!otpFieldDisabled}
                    errorMessage={genericOtpErrorMessage ?? undefined}
                    autoFocus
                    language={language}
                  />
                </View>

                {isOtpOffline ? (
                  <OfflineState
                    title={t("dsOfflineTitle")}
                    description={t("dsOfflineDescription")}
                    retryLabel={t("retry")}
                    onRetry={retryOtpAction}
                    language={language}
                  />
                ) : (
                  <>
                    {isExpired ? (
                      <RetryBanner
                        message={t("authOtpExpiredDescription")}
                        retryLabel={t("resendOTP")}
                        onRetry={resendOtpAndTrack}
                        language={language}
                      />
                    ) : null}
                    {isLockedOut ? (
                      <RetryBanner
                        message={t("authOtpMaxAttemptsDescription")}
                        retryLabel={t("resendOTP")}
                        onRetry={resendOtpAndTrack}
                        language={language}
                      />
                    ) : null}

                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={isSubmittingOtp}
                      disabled={otpFieldDisabled || otp.length !== OTP_LENGTH}
                      onPress={() => submitOtpAndTrack()}
                      language={language}
                      labelStyle={isUrdu ? styles.buttonLabelUrdu : null}
                      style={styles.primaryButton}
                      leadingIcon={forwardArrow.leadingIcon}
                      trailingIcon={forwardArrow.trailingIcon}
                    >
                      {t("verifyAndContinue")}
                    </Button>

                    {!isExpired && !isLockedOut ? (
                      isResendRateLimited || secondsUntilResendAvailable > 0 ? (
                        <Text style={[styles.note, isUrdu ? styles.secondaryUrdu : null, font("regular")]}>
                          {withCountdown(
                            t("authResendAvailableIn"),
                            isResendRateLimited ? (secondsUntilRateLimitCleared ?? 0) : secondsUntilResendAvailable
                          )}
                        </Text>
                      ) : (
                        <View style={[styles.resendRow, rowTowards(copySide)]}>
                          <Text style={[styles.note, styles.noteInline, isUrdu ? styles.secondaryUrdu : null, font("regular")]}>
                            {t("otpDidNotReceive")}
                          </Text>
                          <Pressable
                            onPress={resendOtpAndTrack}
                            disabled={isResending}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isResending, busy: isResending }}
                            hitSlop={8}
                          >
                            <Text style={[styles.link, isResending ? styles.linkBusy : null, font("bold")]}>
                              {t("resendOTP")}
                            </Text>
                          </Pressable>
                        </View>
                      )
                    ) : null}
                  </>
                )}
              </View>
            )}

            <View style={styles.spacer} />
            <View style={styles.footer}>
              <SecureFooter language={language}>{t("authSecureFooter")}</SecureFooter>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingAnimatedView>
    </RequireGuest>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.raised },
  scrollContent: { flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  rowReversed: { flexDirection: "row-reverse", alignItems: "center" },

  hero: {
    paddingHorizontal: spacing[6],
    paddingBottom: SHEET_OVERLAP + spacing[6],
    backgroundColor: HERO_SHADE_COLOR,
    overflow: "hidden",
  },
  heroCopy: { gap: spacing[4] },
  anchorStart: { alignSelf: "flex-start", alignItems: "flex-start" },
  anchorEnd: { alignSelf: "flex-end", alignItems: "flex-end" },
  backPill: {
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 25, 80, 0.35)",
  },
  backText: { fontSize: 14, color: colors.text.inverse },
  heroTitle: {
    marginTop: spacing[3],
    fontSize: 30,
    lineHeight: 35,
    fontWeight: fontWeights.bold,
    color: colors.text.inverse,
    letterSpacing: -0.5,
  },
  // Nastaliq needs ~2x line height so stacked descenders and dots never touch.
  heroTitleUrdu: { fontSize: 24, lineHeight: 48, letterSpacing: 0, paddingHorizontal: spacing[1] },
  heroLead: { marginTop: -spacing[2], fontSize: 14, lineHeight: 21, color: colors.text.inverse, opacity: 0.95 },
  heroLeadUrdu: { marginTop: -spacing[1], fontSize: 14, lineHeight: 28, paddingHorizontal: spacing[1] },

  sheet: {
    flex: 1,
    marginTop: -SHEET_OVERLAP,
    backgroundColor: colors.surface.raised,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  sheetHeading: { alignItems: "flex-start", justifyContent: "space-between", gap: spacing[3], marginBottom: spacing[5] },
  sheetHeadingText: { flex: 1 },
  alignEndUrdu: { alignItems: "stretch" },
  sheetTitle: { fontSize: 24, lineHeight: 30, fontWeight: fontWeights.bold, color: colors.text.primary },
  // Nastaliq's tall line box carries its own top air.
  sheetTitleUrdu: { fontSize: 21, lineHeight: 42, marginTop: -spacing[2] },
  sheetSubtitle: { marginTop: spacing[1], fontSize: 13, lineHeight: 19, color: colors.text.secondary },
  pill: {
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.brand.subtle,
  },
  pillText: { fontSize: 13, fontWeight: fontWeights.bold, color: colors.brand.default },
  pillCountdown: { fontVariant: ["tabular-nums"], fontFamily: getFontFamily("en", "bold") },

  fieldStack: { gap: spacing[4] },
  fieldLabel: { marginBottom: spacing[2], fontSize: 13, color: colors.text.primary },
  primaryButton: { ...elevation.md },
  buttonLabelUrdu: { fontSize: 16 },
  sentBox: {
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.brand.subtle,
  },
  sentText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.text.primary },
  link: { fontSize: 13, color: colors.brand.default },
  linkBusy: { opacity: 0.5 },
  resendRow: { justifyContent: "center", flexWrap: "wrap", gap: spacing[1] },
  note: { fontSize: 12, lineHeight: 18, color: colors.text.secondary, textAlign: "center" },
  noteInline: { textAlign: "auto" },
  // Nastaliq's thin strokes wash out in the standard secondary grey.
  secondaryUrdu: { color: colors.text.primary, opacity: 0.74, lineHeight: 26 },

  spacer: { flexGrow: 1, minHeight: spacing[6], maxHeight: spacing[10] },
  footer: { paddingTop: spacing[4], borderTopWidth: 1, borderTopColor: colors.border.default },
});
