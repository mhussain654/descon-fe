import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Redirect, useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { RestoringScreen } from "../features/auth/RestoringScreen";
import { useAcceptConsent } from "../features/candidate/consent/hooks/useAcceptConsent";
import { Button, ValidationMessage } from "../design-system";
import { colors, fontWeights, radii, spacing } from "../design-system/tokens";

// MPS-204: candidates must accept the current policy version before using
// any other part of the app. RequireAuth (used by every other protected
// screen) redirects here whenever the authenticated session's consent
// hasn't been accepted yet, mirroring the backend's
// ProtectedController#ensure_consent_given! -- this screen only checks
// authentication itself (not RequireAuth, which would redirect right back
// here and loop).
export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { status, session, logout } = useAuth();
  const { accept, isPending, isError, reset } = useAcceptConsent();

  useEffect(() => {
    if (session?.consent?.accepted) {
      router.replace("/(tabs)/dashboard");
    }
  }, [session?.consent?.accepted, router]);

  if (status === "restoring") {
    return <RestoringScreen />;
  }

  if (status !== "authenticated") {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + spacing[6] },
        ]}
      >
        <View style={styles.titleBlock}>
          <View style={styles.logoBadge}>
            <ShieldCheck size={32} color={colors.brand.on} strokeWidth={2} />
          </View>
          <Text style={styles.title}>{t("consentTitle")}</Text>
          <Text style={styles.message}>{t("consentMessage")}</Text>
        </View>

        <View style={styles.fieldStack}>
          {isError ? <ValidationMessage tone="error">{t("consentErrorMessage")}</ValidationMessage> : null}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            onPress={() => {
              reset();
              accept();
            }}
          >
            {t("consentAcceptAction")}
          </Button>

          <Button variant="text" size="sm" fullWidth onPress={() => logout()}>
            {t("consentDeclineAction")}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.raised },
  content: { flexGrow: 1, paddingHorizontal: spacing[6] },
  titleBlock: { marginBottom: spacing[10] },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.brand.default,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[6],
  },
  title: { fontSize: 28, fontWeight: fontWeights.semibold, color: colors.text.primary, marginBottom: spacing[2] },
  message: { fontSize: 16, color: colors.text.secondary, lineHeight: 22 },
  fieldStack: { gap: spacing[5] },
});
