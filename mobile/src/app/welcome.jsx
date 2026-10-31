import { Check } from "lucide-react-native";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "../design-system/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useLanguage } from "../contexts/LanguageContext";
import { getFontFamily } from "../design-system";
import { colors, elevation, fontWeights, radii, spacing } from "../design-system/tokens";
import { RequireGuest } from "../features/auth/RequireGuest";
import { BrandHeader } from "../features/onboarding/BrandHeader";
import { SecureFooter } from "../features/onboarding/SecureFooter";
import { isStartSide, physicalTextAlign, rowDirectionTowards } from "../lib/layoutDirection";
import { translate } from "../../../shared/i18n/translate";

// The hero artwork (one landmark per destination country -- Oman, KSA, UAE,
// Qatar -- with the globe, plane, briefcase and the Descon-branded helmet)
// carries no translatable text. Its open sky is on the left, where the copy sits.
const HERO_ART = require("../../assets/images/welcome-hero.webp");
const HERO_ASPECT_RATIO = 675 / 694;
// The sheet slides up over the plain ground strip at the artwork's base,
// leaving the helmet and briefcase fully visible above it.
const SHEET_OVERLAP = 20;

// The candidate has not chosen a language yet, so every piece of copy on this
// screen shows in both English and Urdu, whichever is selected.
function bilingual(key) {
  return { en: translate("en", key), ur: translate("ur", key) };
}

// Each option's label always renders in its own script, so a candidate who
// can't read the other language can still recognize and pick their own.
// The checkmark mirrors per card: top-right for English, top-left for Urdu.
function LanguageOptionCard({ active, label, labelLanguage, onPress }) {
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
      <Text
        style={[
          styles.languageLabel,
          labelLanguage === "ur" ? styles.languageLabelUrdu : null,
          { fontFamily: getFontFamily(labelLanguage, "bold") },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** One line of copy in both languages, English on the left and Urdu on the right. */
function BilingualRow({ copy, englishStyle, urduStyle, weight = "regular" }) {
  return (
    <View style={[styles.bilingualRow, { flexDirection: rowDirectionTowards("right") }]}>
      <Text style={[englishStyle, styles.englishCell, { fontFamily: getFontFamily("en", weight) }]}>{copy.en}</Text>
      <Text style={[urduStyle, styles.urduCell, { fontFamily: getFontFamily("ur", weight) }]}>{copy.ur}</Text>
    </View>
  );
}

/** Continue, labelled in both languages, each in its own script's font. */
function ContinueButton({ copy, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${copy.en}, ${copy.ur}`}
      style={({ pressed }) => [styles.continueButton, pressed ? styles.continueButtonPressed : null]}
    >
      <View style={[styles.continueRow, { flexDirection: rowDirectionTowards("right") }]}>
        <Text style={[styles.continueLabel, { fontFamily: getFontFamily("en", "semibold") }]}>{copy.en}</Text>
        <View style={styles.continueDivider} />
        <Text style={[styles.continueLabel, styles.continueLabelUrdu, { fontFamily: getFontFamily("ur", "semibold") }]}>{copy.ur}</Text>
      </View>
    </Pressable>
  );
}

function WelcomeHero({ width, topInset }) {
  const heroHeight = width / HERO_ASPECT_RATIO;
  const tagline = bilingual("welcomeTagline");
  const isCompact = width < 380;
  const copySide = isStartSide("left") ? styles.anchorStart : styles.anchorEnd;

  return (
    <View style={{ width, height: heroHeight + topInset, backgroundColor: "#0065B3" }}>
      <Image source={HERO_ART} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors accessible={false} />
      <View style={[styles.brandSlot, { top: topInset + spacing[2] }]}>
        <BrandHeader language="en" primary={translate("en", "brandNamePrimary")} secondary={translate("en", "brandNameSecondary")} />
      </View>
      <View style={[styles.heroCopy, copySide, { top: topInset + heroHeight * 0.24, width: width * 0.6 }]}>
        <Text
          accessibilityRole="header"
          style={[
            styles.tagline,
            isCompact ? styles.taglineCompact : null,
            { textAlign: physicalTextAlign("left"), writingDirection: "ltr", fontFamily: getFontFamily("en", "bold") },
          ]}
        >
          {tagline.en}
        </Text>
        <Text
          style={[
            styles.taglineUrdu,
            isCompact ? styles.taglineUrduCompact : null,
            { textAlign: physicalTextAlign("left"), writingDirection: "rtl", fontFamily: getFontFamily("ur", "bold") },
          ]}
        >
          {tagline.ur}
        </Text>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { language, setLanguage } = useLanguage();

  const handleContinue = () => {
    // `push`, not `replace` -- login's own Back control needs a history
    // entry to return to.
    router.push("/login");
  };

  const continueLabel = bilingual("continue");
  const footer = bilingual("welcomeSecureFooter");

  return (
    <RequireGuest>
      <View style={styles.screen}>
        <StatusBar style="light" />

        {/* Small phones, landscape orientation and larger font scales can push
            this content taller than the viewport -- a ScrollView keeps the
            language options and Continue button reachable instead of
            clipping them off-screen. */}
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
          <WelcomeHero width={width} topInset={insets.top} />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}>
            <BilingualRow
              copy={bilingual("welcomeChooseLanguage")}
              englishStyle={styles.sheetTitle}
              urduStyle={styles.sheetTitleUrdu}
              weight="bold"
            />
            <BilingualRow copy={bilingual("welcomeChooseLanguageHint")} englishStyle={styles.sheetHint} urduStyle={styles.sheetHintUrdu} />

            <View style={[styles.languageRow, { flexDirection: rowDirectionTowards("right") }]}>
              <LanguageOptionCard active={language === "en"} labelLanguage="en" label="English" onPress={() => setLanguage("en")} />
              <LanguageOptionCard active={language === "ur"} labelLanguage="ur" label="اردو" onPress={() => setLanguage("ur")} />
            </View>

            <View style={styles.spacer} />

            <ContinueButton copy={continueLabel} onPress={handleContinue} />

            <View style={styles.footer}>
              <SecureFooter language="en">{footer.en}</SecureFooter>
              <SecureFooter language="ur">{footer.ur}</SecureFooter>
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

  brandSlot: { position: "absolute", start: 0, end: 0, alignItems: "center" },
  heroCopy: { position: "absolute", gap: spacing[2] },
  anchorStart: { start: spacing[6] },
  anchorEnd: { end: spacing[6] },
  tagline: {
    fontSize: 24,
    lineHeight: 31,
    fontStyle: "italic",
    color: colors.text.inverse,
    letterSpacing: -0.3,
    textShadowColor: "rgba(0, 32, 96, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  taglineCompact: { fontSize: 21, lineHeight: 27 },
  // Nastaliq needs ~2x line height so stacked descenders and dots never touch,
  // and side padding so its overhanging strokes are not clipped.
  taglineUrdu: {
    fontSize: 17,
    lineHeight: 36,
    paddingHorizontal: spacing[1],
    color: colors.text.inverse,
    textShadowColor: "rgba(0, 28, 84, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  taglineUrduCompact: { fontSize: 15, lineHeight: 32 },

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
  bilingualRow: { alignItems: "center", justifyContent: "space-between", gap: spacing[3] },
  englishCell: { flexShrink: 1, textAlign: physicalTextAlign("left"), writingDirection: "ltr" },
  urduCell: { flexShrink: 1, textAlign: physicalTextAlign("right"), writingDirection: "rtl", paddingHorizontal: spacing[1] },
  sheetTitle: { fontSize: 19, lineHeight: 26, color: colors.text.primary },
  sheetTitleUrdu: { fontSize: 17, lineHeight: 36, color: colors.text.primary },
  sheetHint: { fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  // Nastaliq's thin strokes wash out in the standard secondary grey, so Urdu
  // secondary copy uses a deeper tone of the same text color.
  sheetHintUrdu: { fontSize: 12, lineHeight: 26, color: colors.text.primary, opacity: 0.74 },

  languageRow: { gap: spacing[3], marginTop: spacing[4] },
  languageCard: {
    flex: 1,
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.xl,
    borderWidth: 2,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[4],
  },
  languageCardActive: { backgroundColor: colors.brand.subtle, borderColor: colors.brand.default },
  languageCardInactive: { backgroundColor: colors.surface.raised, borderColor: colors.border.default, ...elevation.sm },
  languageLabel: { fontSize: 22, color: colors.text.primary, textAlign: "center" },
  // Nastaliq stacks its marks well below the baseline; without an explicit
  // line height the lower strokes are clipped inside the card.
  languageLabelUrdu: { fontSize: 22, lineHeight: 50 },
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
  languageCheckStart: { start: spacing[2] },
  languageCheckEnd: { end: spacing[2] },
  spacer: { flexGrow: 1, minHeight: spacing[5], maxHeight: spacing[12] },
  continueButton: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.brand.default,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  continueButtonPressed: { opacity: 0.85 },
  continueRow: { alignItems: "center", gap: spacing[3] },
  continueLabel: { fontSize: 18, fontWeight: fontWeights.semibold, color: colors.brand.on },
  continueLabelUrdu: { fontSize: 16, lineHeight: 34 },
  continueDivider: { width: 1, height: 20, backgroundColor: colors.brand.on, opacity: 0.5 },
  footer: { marginTop: spacing[4], gap: spacing[1] },
});
