import { Check } from "lucide-react-native";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useLanguage } from "../contexts/LanguageContext";
import { Button, getFontFamily } from "../design-system";
import { colors, elevation, fontWeights, radii, spacing } from "../design-system/tokens";
import { RequireGuest } from "../features/auth/RequireGuest";
import { BrandHeader } from "../features/onboarding/BrandHeader";
import { SecureFooter } from "../features/onboarding/SecureFooter";
import { forwardArrowSlots } from "../features/onboarding/directionalArrows";
import { isStartSide, physicalTextAlign } from "../lib/layoutDirection";

// The hero artwork (skyline, globe, plane, briefcase, helmet) carries no
// brand mark or translatable text -- the headline and subtitle are rendered on
// top of it so they localize like every other string. Urdu gets a mirrored
// copy (scene on the left) so its copy can sit at the reading-start right edge, the way an RTL layout should.
// Top-edge colors are sampled from each image's first row, so the band painted
// behind the status bar continues the hero gradient without a visible seam.
const HERO_ART = {
  en: {
    source: require("../../assets/images/welcome-hero.webp"),
    topEdge: ["#0058E9", "#0E8FFA"],
  },
  ur: {
    source: require("../../assets/images/welcome-hero-rtl.webp"),
    topEdge: ["#0E8FFA", "#0058E9"],
  },
};
const HERO_ASPECT_RATIO = 675 / 694;
const SUBTITLE_SCRIM_COLOR = "#00297A";
// The sheet slides up over the plain ground strip at the artwork's base,
// leaving the helmet and briefcase fully visible above it.
const SHEET_OVERLAP = 20;

// Each option's own label always renders in its own language/script -- "اردو"
// here regardless of which language is currently active -- so a candidate who
// can't yet read the active language can still recognize and pick their own.
// The checkmark mirrors per card, not per active language: top-right for
// English, top-left for Urdu.
function LanguageOptionCard({ active, label, labelLanguage, hint, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.languageCard, active ? styles.languageCardActive : styles.languageCardInactive]}
    >
      {active ? (
        <View
          style={[
            styles.languageCheck,
            isStartSide(labelLanguage === "ur" ? "left" : "right") ? styles.languageCheckStart : styles.languageCheckEnd,
          ]}
        >
          <Check size={14} color={colors.brand.on} strokeWidth={3} />
        </View>
      ) : null}
      <Text style={[styles.languageLabel, { fontFamily: getFontFamily(labelLanguage, "bold") }]}>{label}</Text>
      <Text
        style={[
          styles.languageHint,
          labelLanguage === "ur" ? styles.secondaryTextUrdu : null,
          { fontFamily: getFontFamily(labelLanguage, "regular") },
        ]}
      >
        {hint}
      </Text>
    </Pressable>
  );
}

function WelcomeHero({ width, topInset, language, t }) {
  const isUrdu = language === "ur";
  const heroHeight = width / HERO_ASPECT_RATIO;
  const art = HERO_ART[isUrdu ? "ur" : "en"];
  // Narrow phones (< 380pt) get a step-smaller copy so it keeps clear air
  // between itself and the illustration.
  const isCompact = width < 380;
  // Each artwork leaves its open sky on a fixed physical side -- left for
  // English, right for Urdu -- so the logo and copy anchor to that side.
  const copySide = isUrdu ? "right" : "left";
  const copyAtStart = isStartSide(copySide);
  const anchorStyle = copyAtStart ? styles.anchorStart : styles.anchorEnd;
  const textAlignment = {
    textAlign: physicalTextAlign(copySide),
    writingDirection: isUrdu ? "rtl" : "ltr",
  };

  return (
    <View style={{ backgroundColor: art.topEdge[0] }}>
      <Svg width={width} height={topInset}>
        <Defs>
          <LinearGradient id="heroTopEdge" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={art.topEdge[0]} />
            <Stop offset="1" stopColor={art.topEdge[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={topInset} fill="url(#heroTopEdge)" />
      </Svg>

      <View style={{ width, height: heroHeight }}>
        <Image
          source={art.source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        <View style={[styles.brandSlot, anchorStyle]}>
          <BrandHeader
            language={language}
            primary={t("brandNamePrimary")}
            secondary={t("brandNameSecondary")}
            tileAtRowStart={copyAtStart}
          />
        </View>
        <View
          style={[
            styles.heroCopy,
            anchorStyle,
            { top: heroHeight * (isUrdu ? 0.19 : 0.2), width: width * (isUrdu ? 0.64 : 0.58) },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[
              styles.heroTitle,
              isUrdu ? styles.heroTitleUrdu : null,
              isCompact ? (isUrdu ? styles.heroTitleUrduCompact : styles.heroTitleCompact) : null,
              textAlignment,
              { fontFamily: getFontFamily(language, "bold") },
            ]}
          >
            {t("welcomeHeroTitle")}
          </Text>
          <View style={styles.subtitleWrap}>
            {isUrdu ? (
              // Urdu's description ends over the pale skyline; a soft dark-blue
              // glow (no hard edges) behind it keeps every line in contrast.
              <View style={styles.subtitleScrim} pointerEvents="none">
                <Svg width="100%" height="100%">
                  <Defs>
                    <RadialGradient id="subtitleScrim" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor={SUBTITLE_SCRIM_COLOR} stopOpacity="0.5" />
                      <Stop offset="0.65" stopColor={SUBTITLE_SCRIM_COLOR} stopOpacity="0.28" />
                      <Stop offset="1" stopColor={SUBTITLE_SCRIM_COLOR} stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#subtitleScrim)" />
                </Svg>
              </View>
            ) : null}
            <Text
              style={[
                styles.heroSubtitle,
                isUrdu ? styles.heroSubtitleUrdu : null,
                textAlignment,
                // English wraps freely, so it is narrowed to clear the artwork's
                // dashed flight path and clouds; Urdu carries explicit,
                // measured line breaks instead.
                isUrdu ? null : { maxWidth: width * (isCompact ? 0.53 : 0.56) },
                isCompact ? (isUrdu ? styles.heroSubtitleUrduCompact : styles.heroSubtitleCompact) : null,
                { fontFamily: getFontFamily(language, "semibold") },
              ]}
            >
              {t("welcomeHeroSubtitle")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, language, setLanguage } = useLanguage();
  const isUrdu = language === "ur";

  const handleContinue = () => {
    // `push`, not `replace` -- login's own Back control needs a history
    // entry to return to (it was calling `router.back()` with nowhere to
    // go, silently no-op-ing, when this used `replace`).
    router.push("/login");
  };

  const continueArrow = forwardArrowSlots(language, colors.brand.on);

  return (
    <RequireGuest>
      <View style={styles.screen}>
        <StatusBar style="light" />

        {/* Small phones, landscape orientation and larger font scales can push
            this content taller than the viewport -- a ScrollView keeps the
            language options and Continue button reachable instead of
            clipping them off-screen. */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <WelcomeHero width={width} topInset={insets.top} language={language} t={t} />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}>
            <Text style={[styles.sheetTitle, isUrdu && styles.sheetTitleUrdu, { fontFamily: getFontFamily(language, "bold") }]}>
              {t("welcomeChooseLanguage")}
            </Text>
            <Text style={[styles.sheetHint, isUrdu && styles.sheetHintUrdu, isUrdu && styles.secondaryTextUrdu, { fontFamily: getFontFamily(language, "regular") }]}>
              {t("welcomeChooseLanguageHint")}
            </Text>

            <View style={styles.languageRow}>
              <LanguageOptionCard
                active={language === "en"}
                labelLanguage="en"
                label="English"
                hint="Continue in English"
                onPress={() => setLanguage("en")}
              />
              <LanguageOptionCard
                active={language === "ur"}
                labelLanguage="ur"
                label="اردو"
                hint="اردو میں جاری رکھیں"
                onPress={() => setLanguage("ur")}
              />
            </View>

            <View style={styles.spacer} />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              language={language}
              onPress={handleContinue}
              labelStyle={isUrdu ? styles.continueLabelUrdu : null}
              leadingIcon={continueArrow.leadingIcon}
              trailingIcon={continueArrow.trailingIcon}
            >
              {t("continue")}
            </Button>

            <View style={styles.footer}>
              <SecureFooter language={language}>{t("welcomeSecureFooter")}</SecureFooter>
            </View>
          </View>
        </ScrollView>
      </View>
    </RequireGuest>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.raised },
  scrollContent: { flexGrow: 1 },

  brandSlot: { position: "absolute", top: spacing[4] },
  heroCopy: { position: "absolute" },
  anchorStart: { start: spacing[6], alignItems: "flex-start" },
  anchorEnd: { end: spacing[6], alignItems: "flex-end" },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: fontWeights.bold,
    color: colors.text.inverse,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 32, 96, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // Nastaliq needs ~2x line height so stacked descenders and dots never touch,
  // and side padding so its overhanging strokes are not clipped.
  heroTitleUrdu: { fontSize: 22, lineHeight: 44, letterSpacing: 0, paddingHorizontal: spacing[1] },
  heroTitleCompact: { fontSize: 26, lineHeight: 32 },
  heroTitleUrduCompact: { fontSize: 20, lineHeight: 40 },
  heroSubtitle: {
    marginTop: spacing[3],
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeights.semibold,
    color: colors.text.inverse,
    // A firm dark halo keeps the copy prominent where it crosses the lighter
    // sky, clouds and skyline further down the artwork.
    textShadowColor: "rgba(0, 28, 84, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtitleWrap: { alignSelf: "stretch" },
  // Sits behind the Urdu description only, bleeding evenly past it on every
  // side so the glow has no visible edge.
  subtitleScrim: { position: "absolute", top: -spacing[4], bottom: -spacing[4], start: -spacing[5], end: -spacing[5] },
  heroSubtitleCompact: { fontSize: 14, lineHeight: 20 },
  heroSubtitleUrdu: { fontSize: 15, lineHeight: 30, marginTop: spacing[2], paddingHorizontal: spacing[1] },
  heroSubtitleUrduCompact: { fontSize: 14, lineHeight: 28 },

  sheet: {
    flex: 1,
    marginTop: -SHEET_OVERLAP,
    backgroundColor: colors.surface.raised,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    // Faint upward shadow so the rounded edge reads against the pale ground.
    shadowColor: "#0B3B7A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  sheetTitle: { fontSize: 22, lineHeight: 28, fontWeight: fontWeights.bold, color: colors.text.primary },
  // Nastaliq's tall line box already carries its own top air, so the Urdu
  // heading pulls up to keep the sheet as compact as the English one.
  sheetTitleUrdu: { fontSize: 20, lineHeight: 40, marginTop: -spacing[2] },
  sheetHint: { marginTop: spacing[1], fontSize: 14, lineHeight: 20, color: colors.text.secondary },
  sheetHintUrdu: { fontSize: 13, lineHeight: 28 },

  languageRow: { flexDirection: "row", gap: spacing[3], marginTop: spacing[5] },
  languageCard: {
    flex: 1,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.xl,
    borderWidth: 2,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[4],
  },
  languageCardActive: { backgroundColor: colors.brand.subtle, borderColor: colors.brand.default },
  languageCardInactive: { backgroundColor: colors.surface.raised, borderColor: colors.border.default, ...elevation.sm },
  languageLabel: { fontSize: 20, fontWeight: fontWeights.bold, color: colors.text.primary, textAlign: "center" },
  languageHint: { marginTop: spacing[1], fontSize: 14, color: colors.text.secondary, textAlign: "center" },
  languageCheck: {
    position: "absolute",
    top: spacing[2],
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand.default,
    alignItems: "center",
    justifyContent: "center",
  },

  continueLabelUrdu: { fontSize: 16 },
  languageCheckStart: { start: spacing[2] },
  languageCheckEnd: { end: spacing[2] },
  spacer: { flexGrow: 1, minHeight: spacing[5], maxHeight: spacing[12] },
  footer: { marginTop: spacing[4] },
  // Nastaliq's thin strokes wash out in the standard secondary grey, so Urdu
  // secondary copy uses a deeper tone of the same text color.
  secondaryTextUrdu: { color: colors.text.primary, opacity: 0.74 },
});
