import { Redirect } from "expo-router";
import { View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { LoadingState } from "../../design-system";
import { colors } from "../../design-system/tokens";

/**
 * Guards candidate-only screens. `status` starts as `'restoring'` while the
 * secure-store session read is in flight (see AuthContext) -- protected
 * content must not render during that window either, so this shows a
 * loading state instead of flashing the login screen or (worse) stale
 * protected content before authorization is confirmed.
 */
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const { t } = useLanguage();

  if (status === "restoring") {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.surface.background }}>
        <LoadingState message={t("loading")} />
      </View>
    );
  }

  if (status !== "authenticated") {
    return <Redirect href="/login" />;
  }

  return children;
}
