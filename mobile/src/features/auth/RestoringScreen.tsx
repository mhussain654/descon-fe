import { View } from "react-native";
import { useLanguage } from "../../contexts/LanguageContext";
import { LoadingState } from "../../design-system";
import { colors } from "../../design-system/tokens";

/**
 * Neutral full-screen loading state shown while `AuthContext`'s SecureStore
 * read is in flight (`status === 'restoring'`). Shared by every route that
 * must not flash Welcome, Login or protected content before restoration
 * resolves: the root route, `RequireAuth` (protected tabs) and `RequireGuest`
 * (Welcome/Login).
 */
export function RestoringScreen() {
  const { t } = useLanguage();
  return (
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.surface.background }}>
      <LoadingState message={t("loading")} />
    </View>
  );
}
