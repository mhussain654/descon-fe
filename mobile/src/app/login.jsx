import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "../design-system/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Clock, IdCard } from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { RequireGuest } from "../features/auth/RequireGuest";
import { RegistrationGuidance } from "../features/onboarding/RegistrationGuidance";
import { BRAND_ROW_HEIGHT, BrandRow } from "../features/onboarding/BrandRow";
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
import { formatCnic } from "../../../shared/cnic";
import { OTP_LENGTH } from "../../../shared/auth/types";
import { useCnicOtpFlow } from "../../../shared/auth/useCnicOtpFlow";
import { candidateAuthClient } from "../lib/auth-client";

// The same artwork as the language page (no person): the landmarks, globe and
// Descon-branded helmet, with open sky on one side for the copy -- left in
// English, and in the mirrored Urdu copy on the right. Only the white sheet
// below differs between the two screens.
const HERO_ART = {
  en: require("../../assets/images/welcome-hero.webp"),
  ur: require("../../assets/images/welcome-hero-rtl.webp"),
};
// The sheet's rounded top slides up over the plain ground at the art's base.
const SHEET_OVERLAP = 28;
const HERO_ASPECT_RATIO = 675 / 694;
// A soft dark halo keeps the white copy readable where it crosses lighter sky and clouds.
const HERO_TEXT_SHADOW = {
  textShadowColor: "rgba(0, 28, 84, 0.7)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
};

// The number every OTP SMS arrives from, shown so candidates know which message to open.
const OTP_SENDER_NUMBER = "8062050";

// A row whose first child sits on the given physical side in the live layout.
function rowTowards(side) {
  return isStartSide(side) ? styles.row : styles.rowReversed;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  // The hero art stays pinned at the top; only the white sheet scrolls.
  // KeyboardAvoidingAnimatedView shrinks the viewport when the keyboard opens,
  // and this then slides the sheet up over the art's lower part, so the field
  // being typed in is never left behind the keyboard while the logo, Back and
  // heading stay in view.
  const scrollRef = useRef(null);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    let scrollTimer;
    const showSubscription = Keyboard.addListener(showEvent, () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 320);
    });
    // Once the keyboard closes, go back to the top so the logo and heading are visible again.
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      clearTimeout(scrollTimer);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => {
      clearTimeout(scrollTimer);
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Exactly the art's own height at full width (less a little plain sky), on
  // both steps: a taller box would make "cover" scale it up and crop its sides.
  const heroHeight = insets.top + (width / HERO_ASPECT_RATIO) * 0.9;
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

  // The CNIC shown in the not-registered dialog is the one that was submitted, frozen when the
  // error arrives -- never the live field, which changes as the candidate types a correction.
  const cnicRef = useRef(cnic);
  cnicRef.current = cnic;
  const [notRegisteredCnic, setNotRegisteredCnic] = useState("");
  useEffect(() => {
    const notFound = otpError?.code === "CNIC_NOT_FOUND";
    if (notFound) setNotRegisteredCnic(cnicRef.current);
    setRegistrationGuidanceOpen(notFound);
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

  const [sentFromBefore, sentFromAfter = ""] = t("otpCodeSentFromSender").split("%{sender}");
  const showExpiryPill = !isExpired && !isLockedOut && !isOtpOffline;
  const expiryCountdown = formatCountdown(secondsUntilExpiry ?? 0);

  return (
    <RequireGuest>
      <KeyboardAvoidingAnimatedView style={styles.screen} behavior="padding">
        <RegistrationGuidance open={registrationGuidanceOpen} onClose={() => setRegistrationGuidanceOpen(false)} title={t("authCnicNotFoundError")} description={t("authRegistrationGuidance")} closeLabel={t("authChangeCnic")} language={language} cnic={formatCnic(notRegisteredCnic)} cnicLabel={t("authCnicEnteredLabel")} />
        <StatusBar style="light" />

        {/* Keep navigation visible while the keyboard scrolls the CNIC field
            into view; the hero itself can move beneath Android's status bar.
            The logo row starts on the reading side, so Back sits on the other
            side of the same line. A language switch reloads the app onto this
            screen with no history, so Back then opens the language page. */}
        <Pressable
          onPress={() => {
            if (step === "otp") backToCnic();
            else if (router.canGoBack()) router.back();
            else router.replace("/welcome");
          }}
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          style={[styles.backPill, styles.fixedBack, rowTowards(copySide),
            isUrdu ? { left: spacing[6] } : { right: spacing[6] },
            // Centred on the logo tile: half the difference between the tile and this pill (44).
            { top: insets.top + spacing[3] + (BRAND_ROW_HEIGHT - 44) / 2 }]}
          hitSlop={8}
        >
          <BackArrow language={language} color={colors.text.inverse} />
          <Text style={[styles.backText, isUrdu ? styles.backTextUrdu : null, font("semibold")]}>{t("back")}</Text>
        </Pressable>

        {/* Pinned behind the scrolling sheet, so opening the keyboard never
            scrolls the art away. */}
        <View style={[styles.hero, { height: heroHeight, paddingTop: insets.top + spacing[3] + BRAND_ROW_HEIGHT + spacing[3] }]}>
          <Image
            source={HERO_ART[isUrdu ? "ur" : "en"]}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // Keep the landmarks and helmet in view; any crop comes off the plain sky.
            contentPosition="bottom"
            accessible={false}
          />

          <View style={[styles.brandSlot, { top: insets.top + spacing[3] }]}>
            <BrandRow language={language} primary={t("brandNamePrimary")} secondary={t("brandNameSecondary")} side={copySide} />
          </View>

          <View style={[styles.heroCopy, anchorStyle, { maxWidth: width * (isUrdu ? 0.7 : 0.6) }]}>
            <Text
              accessibilityRole="header"
              style={[styles.heroTitle, isUrdu ? styles.heroTitleUrdu : null, copyTextStyle, font("bold")]}
            >
              {step === "cnic" ? t("loginHeroTitle") : t("otpHeroTitle")}
            </Text>
            {step === "cnic" ? (
              <Text style={[styles.heroLead, isUrdu ? styles.heroLeadUrdu : null, copyTextStyle, font("medium")]}>
                {t("loginHeroSubtitle")}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Small phones, landscape orientation and larger font scales can push
            this content taller than the viewport -- a ScrollView keeps the
            field and its action reachable instead of clipping them off-screen. */}
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={{ height: heroHeight }} />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[3] }]}>
            {step === "otp" ? (
              // On the white sheet, not over the art, so it stays easy to read.
              <Text style={[styles.sentFrom, isUrdu ? styles.sentFromUrdu : null, copyTextStyle, font("regular")]}>
                {sentFromBefore}
                <Text style={styles.sentFromSender}>{OTP_SENDER_NUMBER}</Text>
                {sentFromAfter}
              </Text>
            ) : null}

            {/* The heading shares its line with the language button (or the
                code's countdown), so the guidance below gets the full width. */}
            <View style={[styles.sheetHeading, rowTowards(copySide)]}>
              <Text style={[styles.sheetTitle, styles.sheetHeadingText, isUrdu ? styles.sheetTitleUrdu : null, copyTextStyle, font("bold")]}>
                {step === "cnic" ? t("login") : t("otpSheetTitle")}
              </Text>

              {step === "cnic" ? (
                // Each language names itself in its own script, so a candidate
                // who can't read the active language can still find theirs.
                <Pressable
                  onPress={() => toggleLanguage("/login")}
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
              <View style={styles.sheetGuidance}>
                <Text style={[styles.sheetSubtitle, isUrdu ? styles.secondaryUrdu : null, copyTextStyle, font("regular")]}>
                  {t("loginSheetSubtitle")}
                </Text>
                <Text style={[styles.sheetSubtitle, isUrdu ? styles.secondaryUrdu : null, copyTextStyle, font("regular")]}>
                  {t("loginOtpNotice")}
                </Text>
              </View>
            ) : (
              <View style={styles.sheetGuidanceOtp} />
            )}

            {step === "cnic" ? (
              <View style={styles.fieldStack}>
                <CnicField
                  label={t("cnic")}
                  placeholder={t("enterCNIC")}
                  helperText={t("authCnicExample")}
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
                      {t("continue")}
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
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    paddingHorizontal: spacing[6],
    backgroundColor: "#0065B3",
    overflow: "hidden",
  },
  brandSlot: { position: "absolute", start: spacing[6], end: spacing[6] },
  heroCopy: { gap: spacing[4] },
  anchorStart: { alignSelf: "flex-start", alignItems: "flex-start" },
  anchorEnd: { alignSelf: "flex-end", alignItems: "flex-end" },
  backPill: {
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.full,
    backgroundColor: "#004C87",
  },
  fixedBack: { position: "absolute", zIndex: 10, minHeight: 44, alignItems: "center", ...elevation.sm },
  backText: { fontSize: 14, color: colors.text.inverse },
  // Nastaliq sits low in its line box; lifting it a touch lines it up with the arrow.
  backTextUrdu: { lineHeight: 28, position: "relative", top: -3 },
  heroTitle: {
    marginTop: spacing[3],
    fontSize: 30,
    lineHeight: 35,
    color: colors.text.inverse,
    letterSpacing: -0.5,
    ...HERO_TEXT_SHADOW,
  },
  // Nastaliq needs ~2x line height so stacked descenders and dots never touch.
  heroTitleUrdu: { fontSize: 24, lineHeight: 48, letterSpacing: 0, paddingHorizontal: spacing[1] },
  // The width cap breaks the English tagline into two even lines
  // ("Your Gateway to" / "Overseas Employment") on every phone width.
  heroLead: { marginTop: -spacing[2], maxWidth: 210, fontSize: 17, lineHeight: 24, color: colors.text.inverse, ...HERO_TEXT_SHADOW },
  heroLeadUrdu: { marginTop: -spacing[1], maxWidth: "100%", fontSize: 14, lineHeight: 28, paddingHorizontal: spacing[1] },

  sheet: {
    flex: 1,
    marginTop: -SHEET_OVERLAP,
    backgroundColor: colors.surface.raised,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  sheetHeading: { alignItems: "center", justifyContent: "space-between", gap: spacing[3] },
  sheetHeadingText: { flex: 1 },
  sheetGuidance: { marginBottom: spacing[3] },
  sheetGuidanceOtp: { height: spacing[3] },
  sentFrom: { marginBottom: spacing[3], fontSize: 14, lineHeight: 21, color: colors.text.primary },
  sentFromUrdu: { lineHeight: 30 },
  // The digits stay in the Latin face even inside Urdu text.
  sentFromSender: { fontFamily: getFontFamily("en", "bold") },
  sheetTitle: { fontSize: 24, lineHeight: 30, color: colors.text.primary },
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
  pillText: { fontSize: 13, color: colors.brand.default },
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

  spacer: { flexGrow: 1, minHeight: spacing[2], maxHeight: spacing[10] },
  footer: { paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.default },
});
