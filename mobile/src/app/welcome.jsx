import { Check } from "lucide-react-native";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../design-system";
import { colors, fontWeights, radii, spacing } from "../design-system/tokens";
import { RequireGuest } from "../features/auth/RequireGuest";

function LanguageOptionCard({ active, flag, label, hint, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.languageCard, active ? styles.languageCardActive : styles.languageCardInactive]}
    >
      <View style={styles.languageCardLeft}>
        <Text style={styles.languageFlag} accessibilityElementsHidden importantForAccessibility="no">
          {flag}
        </Text>
        <View>
          <Text style={styles.languageLabel}>{label}</Text>
          <Text style={styles.languageHint}>{hint}</Text>
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
    router.replace("/login");
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
            <Text style={styles.title}>{t("welcomeTitle")}</Text>
            <Text style={styles.message}>{t("welcomeMessage")}</Text>
          </View>

          <View style={styles.languageBlock}>
            <Text style={styles.selectLabel}>{t("selectLanguage")}</Text>
            <View style={styles.languageList}>
              <LanguageOptionCard
                active={language === "en"}
                flag="🇬🇧"
                label={t("englishLabel")}
                hint={t("englishHint")}
                onPress={() => setLanguage("en")}
              />
              <LanguageOptionCard
                active={language === "ur"}
                flag="🇵🇰"
                label={t("urduLabel")}
                hint={t("urduHint")}
                onPress={() => setLanguage("ur")}
              />
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <Button variant="primary" size="lg" fullWidth onPress={handleContinue}>
            {t("continue")}
          </Button>

          <Text style={styles.footer}>{t("companyFooter")}</Text>
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
  languageCardLeft: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  languageFlag: { fontSize: 24 },
  languageLabel: { fontSize: 16, fontWeight: fontWeights.semibold, color: colors.text.primary },
  languageHint: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
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
