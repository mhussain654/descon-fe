import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { RestoringScreen } from "../features/auth/RestoringScreen";
import { useAcceptConsent } from "../features/candidate/consent/hooks/useAcceptConsent";
import { ConsentContent } from "../features/candidate/consent/ConsentContent";
import { colors } from "../design-system/tokens";

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
  const { t, language, toggleLanguage } = useLanguage();
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
      <StatusBar style="light" />
      <ConsentContent
        language={language}
        t={t}
        topInset={insets.top}
        bottomInset={insets.bottom}
        isPending={isPending}
        isError={isError}
        onToggleLanguage={toggleLanguage}
        onAccept={() => { reset(); accept(); }}
        onLogout={() => logout()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.raised },
});
