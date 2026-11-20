import { useState } from "react";
import { Check } from "lucide-react-native";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Text } from "../design-system/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useLanguage } from "../contexts/LanguageContext";
import { Button, getFontFamily } from "../design-system";
import { colors, elevation, radii, spacing } from "../design-system/tokens";
import { RequireGuest } from "../features/auth/RequireGuest";
import { BrandRow } from "../features/onboarding/BrandRow";
import { SecureFooter } from "../features/onboarding/SecureFooter";
import { HeroArtwork } from "../features/onboarding/HeroArtwork";
import { heroArtLayout } from "../features/onboarding/heroArtLayout";
import { ThemeToggleButton } from "../features/onboarding/ThemeToggleButton";
import { TaglineBanner } from "../features/onboarding/TaglineBanner";
import { forwardArrowSlots } from "../features/onboarding/directionalArrows";
import { isStartSide, physicalTextAlign, rowDirectionTowards } from "../lib/layoutDirection";
import { themedStyles } from '../design-system/theme';

// The client's design: the hero artwork (landmarks of the destination
// countries, globe, plane, briefcase and the Descon-branded helmet) with the
// logo row, the welcome and the tagline banner in its open sky. English keeps
// the sky on the left; Urdu uses the mirrored copy, with the welcome top right.
// The artwork moves down as far as the copy needs, so the banner never covers
// the skyline (see heroArtLayout).

// Each option's label always renders in its own script, so a candidate who
// can't read the active language can still recognize and pick their own.
// The checkmark mirrors per card: top-right for English, top-left for Urdu.
function LanguageOptionCard({ active, label, hint, labelLanguage, onPress }) {
  const isUrduLabel = labelLanguage === "ur";
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
            isStartSide(isUrduLabel ? "left" : "right") ? styles.languageCheckStart : styles.languageCheckEnd,
          ]}
        >
          <Check size={14} color={colors.brand.on} strokeWidth={3} />
        </View>
      ) : null}
      <Text style={[styles.languageLabel, isUrduLabel && styles.languageLabelUrdu, { fontFamily: getFontFamily(labelLanguage, "bold") }]}>
        {label}
      </Text>
      <Text style={[styles.languageHint, isUrduLabel && styles.languageHintUrdu, { fontFamily: getFontFamily(labelLanguage, "regular") }]}>
        {hint}
      </Text>
    </Pressable>
  );
}

/** The logo row, the welcome and the tagline in the chosen language, in the artwork's open sky. */
function WelcomeHero({ width, topInset, language, layout, onCopyBottom, t }) {
  const isUrdu = language === "ur";
  const copySide = isUrdu ? "right" : "left";
  const isCompact = width < 380;
  const copyText = { textAlign: physicalTextAlign(copySide), writingDirection: isUrdu ? "rtl" : "ltr" };

  return (
    <View style={[styles.hero, { height: layout.heroHeight }]}>
      <HeroArtwork language={language} width={width} artTop={layout.artTop} artHeight={layout.artHeight} visible={layout.measured} />
      {/* Opposite the logo: top right in English, top left in Urdu. */}
      <View style={[styles.themeToggle, { top: topInset + spacing[3] }, isUrdu ? { left: spacing[6] } : { right: spacing[6] }]}>
        <ThemeToggleButton t={t} />
      </View>
      <View
        style={[styles.heroCopy, { paddingTop: topInset + spacing[3] }]}
        onLayout={(event) => onCopyBottom(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
      >
        <BrandRow language={language} primary={t("brandNamePrimary")} secondary={t("brandNameSecondary")} side={copySide} />
        <View style={[styles.welcome, isStartSide(copySide) ? styles.alignStart : styles.alignEnd, { maxWidth: width * 0.62 }]}>
          <Text
            accessibilityRole="header"
            style={[
              isUrdu ? styles.headingUrdu : styles.heading,
              isCompact && (isUrdu ? styles.headingUrduCompact : styles.headingCompact),
              copyText,
              { fontFamily: getFontFamily(language, "bold") },
            ]}
          >
            {t("welcomeHeading")}
          </Text>
          <TaglineBanner text={t("welcomeTagline")} language={language} side={copySide} />
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
  const [copyBottom, setCopyBottom] = useState(null);
  const layout = { ...heroArtLayout(width, copyBottom), measured: copyBottom != null };
  const sheetText = { textAlign: physicalTextAlign(isUrdu ? "right" : "left"), writingDirection: isUrdu ? "rtl" : "ltr" };

  const handleContinue = () => {
    // `push`, not `replace` -- login's own Back control needs a history
    // entry to return to.
    router.push("/login");
  };

  const continueArrow = forwardArrowSlots(language, colors.brand.on);

  return (
    <RequireGuest>
      <View style={styles.screen}>
        <StatusBar style="light" />

        {/* Fits one screen on supported phones; the ScrollView only matters
            for large font scales or landscape, where clipping the language
            options and Continue would be worse than scrolling. */}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
          <WelcomeHero width={width} topInset={insets.top} language={language} layout={layout} onCopyBottom={setCopyBottom} t={t} />

          <View style={[styles.sheet, { marginTop: -layout.sheetOverlap, paddingBottom: insets.bottom + spacing[4] }]}>
            <Text style={[styles.sheetTitle, isUrdu && styles.sheetTitleUrdu, sheetText, { fontFamily: getFontFamily(language, "bold") }]}>
              {t("welcomeChooseLanguage")}
            </Text>
            <Text style={[styles.sheetHint, isUrdu && styles.sheetHintUrdu, sheetText, { fontFamily: getFontFamily(language, "regular") }]}>
              {t("welcomeChooseLanguageHint")}
            </Text>

            {/* English on the left and Urdu on the right, as in the client's design. */}
            <View style={[styles.languageRow, { flexDirection: rowDirectionTowards("left") }]}>
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

            <Button
              variant="primary"
              size="lg"
              fullWidth
              language={language}
              onPress={handleContinue}
              style={styles.continueButton}
              labelStyle={isUrdu ? styles.continueLabelUrdu : null}
              leadingIcon={continueArrow.leadingIcon}
              trailingIcon={continueArrow.trailingIcon}
            >
              {t("continue")}
            </Button>

            <View style={styles.spacer} />
            <SecureFooter language={language}>{t("welcomeSecureFooter")}</SecureFooter>
          </View>
        </ScrollView>
      </View>
    </RequireGuest>
  );
}

const TEXT_SHADOW = {
  textShadowColor: "rgba(0, 32, 96, 0.4)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.surface.raised },
  scrollContent: { flexGrow: 1 },

  hero: { overflow: "hidden", backgroundColor: "#006AF1" },
  heroCopy: { paddingHorizontal: spacing[6] },
  themeToggle: { position: "absolute", zIndex: 1 },
  welcome: { marginTop: spacing[5] },
  alignStart: { alignSelf: "flex-start" },
  alignEnd: { alignSelf: "flex-end" },
  heading: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: colors.text.inverse, ...TEXT_SHADOW },
  headingCompact: { fontSize: 28, lineHeight: 34 },
  // Nastaliq needs ~2x line height so stacked descenders and dots never touch,
  // and side padding so its overhanging strokes are not clipped.
  headingUrdu: { fontSize: 24, lineHeight: 50, paddingHorizontal: spacing[1], color: colors.text.inverse, ...TEXT_SHADOW },
  headingUrduCompact: { fontSize: 21, lineHeight: 44 },

  sheet: {
    flex: 1,
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
    paddingTop: spacing[5],
  },
  sheetTitle: { fontSize: 22, lineHeight: 28, color: colors.text.primary },
  // Nastaliq's tall line box already carries its own top air.
  sheetTitleUrdu: { fontSize: 20, lineHeight: 40, marginTop: -spacing[2] },
  sheetHint: { marginTop: spacing[1], fontSize: 14, lineHeight: 20, color: colors.text.secondary },
  // Nastaliq's thin strokes wash out in the standard secondary grey.
  sheetHintUrdu: { fontSize: 13, lineHeight: 28, color: colors.text.primary, opacity: 0.74 },

  languageRow: { gap: spacing[3], marginTop: spacing[4] },
  languageCard: {
    flex: 1,
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.xl,
    borderWidth: 2,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  languageCardActive: { backgroundColor: colors.brand.subtle, borderColor: colors.brand.default },
  languageCardInactive: { backgroundColor: colors.surface.raised, borderColor: colors.border.default, ...elevation.sm },
  languageLabel: { fontSize: 19, color: colors.text.primary, textAlign: "center" },
  languageHint: { marginTop: spacing[1], fontSize: 13, color: colors.text.secondary, textAlign: "center" },
  // Nastaliq stacks its marks well below the baseline; without an explicit
  // line height the lower strokes are clipped inside the card.
  languageLabelUrdu: { fontSize: 19, lineHeight: 42 },
  languageHintUrdu: { marginTop: 0, fontSize: 13, lineHeight: 28, color: colors.text.primary, opacity: 0.74 },
  languageCheck: {
    position: "absolute",
    top: spacing[2],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand.default,
    alignItems: "center",
    justifyContent: "center",
  },
  languageCheckStart: { start: spacing[2] },
  languageCheckEnd: { end: spacing[2] },

  continueButton: { marginTop: spacing[4] },
  continueLabelUrdu: { fontSize: 16 },
  spacer: { flexGrow: 1, minHeight: spacing[3] },
}));
