import { Check } from "lucide-react-native";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useLanguage } from "../contexts/LanguageContext";
import { Button, getFontFamily } from "../design-system";
import { colors, fontWeights, radii, spacing } from "../design-system/tokens";
import { RequireGuest } from "../features/auth/RequireGuest";

// Each option's own label always renders in its own language/script -- "اردو"
// here regardless of which language is currently active -- the standard
// pattern real apps use for a language switcher, so a candidate who can't yet
// read the active language can still recognize and pick their own. The
// card's own internal layout mirrors per-card too (independent of the app's
// global RTL state, which only ever reflects the *active* language and so
// can't correctly orient two cards representing two different languages at
// once): the Urdu card's text is right-aligned and sits snug against the
// checkmark on the right, instead of the fixed left-to-right arrangement
// that reads oddly for Urdu's own script.
function LanguageOptionCard({ active, label, labelLanguage, hint, onPress }) {
  const isRtl = labelLanguage === "ur";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.languageCard,
        active ? styles.languageCardActive : styles.languageCardInactive,
        isRtl && styles.languageCardRtl,
      ]}
    >
      <View style={styles.languageCardLeft}>
        <View style={isRtl && styles.languageCardTextRtl}>
          <Text
            style={[
              styles.languageLabel,
              { fontFamily: getFontFamily(labelLanguage, "semibold") },
              isRtl && styles.textRight,
            ]}
          >
            {label}
          </Text>
          <Text
            style={[
              styles.languageHint,
              { fontFamily: getFontFamily(labelLanguage, "regular") },
              isRtl && styles.textRight,
            ]}
          >
            {hint}
          </Text>
        </View>
      </View>
      {active ? (
        <View style={styles.languageCheck}>
          <Check size={16} color={colors.brand.on} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();

  const handleContinue = () => {
    // `push`, not `replace` -- login's own Back control needs a history
    // entry to return to (it was calling `router.back()` with nowhere to
    // go, silently no-op-ing, when this used `replace`).
    router.push("/login");
  };

  return (
    <RequireGuest>
      <View style={styles.screen}>
        <StatusBar style="dark" />

        {/* Small phones, landscape orientation and larger font scales can push
            this content taller than the viewport -- a ScrollView (rather than
            the previous fixed View) keeps the language options and Continue
            button reachable instead of clipping them off-screen. */}
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + spacing[6] },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <Image
              source={{ uri: "https://ucarecdn.com/26b1d36a-12cf-4efa-853d-08da75f95d7e/-/format/auto/" }}
              style={styles.logo}
              contentFit="contain"
            />
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { fontFamily: getFontFamily(language, "semibold") }]}>{t("welcomeTitle")}</Text>
            <Text style={[styles.message, { fontFamily: getFontFamily(language, "regular") }]}>{t("welcomeMessage")}</Text>
          </View>

          <View style={styles.languageBlock}>
            <Text style={[styles.selectLabel, { fontFamily: getFontFamily(language, "medium") }]}>{t("selectLanguage")}</Text>
            <View style={styles.languageList}>
              {/* Each card's label/hint always renders in that language's own
                  script, never translated into the currently active language --
                  the standard self-identifying pattern for a language switcher. */}
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
          </View>

          <View style={{ flex: 1 }} />

          <Button variant="primary" size="lg" fullWidth onPress={handleContinue}>
            {t("continue")}
          </Button>

          <Text style={[styles.footer, { fontFamily: getFontFamily(language, "regular") }]}>{t("companyFooter")}</Text>
        </ScrollView>
      </View>
    </RequireGuest>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.raised },
  content: { flexGrow: 1, paddingHorizontal: spacing[6] },
  logoWrap: { alignItems: "center", marginBottom: spacing[12] },
  logo: { width: 160, height: 60 },
  titleBlock: { marginBottom: spacing[12] },
  title: {
    fontSize: 32,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    marginBottom: spacing[3],
    textAlign: "center",
  },
  message: { fontSize: 16, color: colors.text.secondary, textAlign: "center", lineHeight: 24 },
  languageBlock: { marginBottom: spacing[12] },
  selectLabel: {
    fontSize: 14,
    fontWeight: fontWeights.medium,
    color: colors.text.primary,
    marginBottom: spacing[4],
    textAlign: "center",
  },
  languageList: { gap: spacing[3] },
  languageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.lg,
    borderWidth: 2,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  languageCardActive: { backgroundColor: colors.brand.subtle, borderColor: colors.brand.default },
  languageCardInactive: { backgroundColor: colors.surface.sunken, borderColor: colors.border.default },
  // Mirrors the row for Urdu: the checkmark moves to the far left and the
  // text block to the far right (space-between is inherited unchanged from
  // languageCard, so a single child -- the inactive, checkmark-less case --
  // still lands at the row's start, which row-reverse makes the right side).
  languageCardRtl: { flexDirection: "row-reverse" },
  languageCardLeft: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  languageCardTextRtl: { alignItems: "flex-end" },
  languageLabel: { fontSize: 16, fontWeight: fontWeights.semibold, color: colors.text.primary },
  languageHint: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  textRight: { textAlign: "right" },
  languageCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand.default,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { fontSize: 12, color: colors.text.tertiary, textAlign: "center", marginTop: spacing[6] },
});
