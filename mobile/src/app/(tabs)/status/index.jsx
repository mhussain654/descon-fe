import { View, Text, ScrollView, RefreshControl, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CheckCircle, Circle, Clock } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useRouter } from "expo-router";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState } from "../../../design-system";
import { buildStatusTimeline } from "../../../../../shared/applicationProgress/statusTimeline";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../../shared/applicationProgress/errorMessages";

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useLanguage();
  const { logout } = useAuth();
  const progressQuery = useApplicationProgress();
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "completed":
        return {
          icon: CheckCircle,
          iconColor: "#10B981",
          lineColor: "#10B981",
          textColor: isDark ? "#FFFFFF" : "#000000",
        };
      case "current":
        return {
          icon: Clock,
          iconColor: "#0066CC",
          lineColor: "#E5E7EB",
          textColor: isDark ? "#FFFFFF" : "#000000",
        };
      default:
        return {
          icon: Circle,
          iconColor: isDark ? "#4B5563" : "#D1D5DB",
          lineColor: isDark ? "#333333" : "#E5E7EB",
          textColor: isDark ? "#6B7280" : "#9CA3AF",
        };
    }
  };

  const timeline = progressQuery.data ? buildStatusTimeline(progressQuery.data) : null;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: isDark ? "#121212" : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#333333" : "#F0F0F0",
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#FFFFFF" : "#000000",
            marginBottom: 4,
          }}
        >
          {t("status")}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#9CA3AF" : "#6B7280",
          }}
        >
          {t("mobilizationProgress")}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: insets.bottom + 80,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={progressQuery.isRefetching} onRefresh={() => progressQuery.refetch()} title={t("pullToRefresh")} />
        }
      >
        {progressQuery.isLoading ? <LoadingState message={t("loading")} /> : null}

        {progressQuery.error?.code === "SESSION_EXPIRED" ? (
          <SessionExpiredState
            title={t("dsSessionExpiredTitle")}
            description={t("dsSessionExpiredDescription")}
            actionLabel={t("dsSessionExpiredAction")}
            onAction={returnToSignIn}
          />
        ) : null}

        {progressQuery.error?.code === "INACTIVE_ACCOUNT" ? (
          <ForbiddenState
            title={t("candidateProfileInactiveAccountTitle")}
            description={t("candidateProfileInactiveAccountDescription")}
            actionLabel={t("candidateProfileInactiveAccountAction")}
            onAction={returnToSignIn}
          />
        ) : null}

        {progressQuery.error?.code === "OFFLINE" ? (
          <OfflineState
            title={t("dsOfflineTitle")}
            description={t("dsOfflineDescription")}
            retryLabel={t("retry")}
            onRetry={() => progressQuery.refetch()}
          />
        ) : null}

        {progressQuery.error && !["OFFLINE", "SESSION_EXPIRED", "INACTIVE_ACCOUNT"].includes(progressQuery.error.code) ? (
          <ErrorState
            message={t(APPLICATION_PROGRESS_ERROR_KEYS[progressQuery.error.code])}
            retryLabel={t("retry")}
            onRetry={() => progressQuery.refetch()}
          />
        ) : null}

        {/* Timeline */}
        {timeline ? (
          <View>
            {timeline.map((item, index) => {
              const config = getStatusConfig(item.status);
              const StatusIcon = config.icon;
              const isLast = index === timeline.length - 1;

              return (
                <View key={item.labelKey} style={{ flexDirection: "row" }}>
                  {/* Icon Column */}
                  <View style={{ alignItems: "center", marginRight: 16 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor:
                          item.status === "current"
                            ? isDark
                              ? "#1A2B3D"
                              : "#E6F2FF"
                            : isDark
                              ? "#1E1E1E"
                              : "#FFFFFF",
                        borderWidth: item.status === "pending" ? 2 : 0,
                        borderColor: isDark ? "#333333" : "#E5E7EB",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <StatusIcon
                        size={item.status === "pending" ? 12 : 18}
                        color={config.iconColor}
                        fill={item.status === "completed" ? config.iconColor : "none"}
                      />
                    </View>

                    {!isLast && (
                      <View
                        style={{
                          width: 2,
                          flex: 1,
                          backgroundColor: config.lineColor,
                          marginVertical: 4,
                          minHeight: 40,
                        }}
                      />
                    )}
                  </View>

                  {/* Content Column */}
                  <View
                    style={{
                      flex: 1,
                      paddingBottom: isLast ? 0 : 24,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: item.status === "current" ? "Inter_600SemiBold" : "Inter_500Medium",
                        color: config.textColor,
                        marginBottom: 2,
                      }}
                    >
                      {t(item.labelKey)}
                    </Text>
                    {item.status === "current" && (
                      <View
                        style={{
                          backgroundColor: isDark ? "#1A2B3D" : "#E6F2FF",
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginTop: 8,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: "Inter_500Medium",
                            color: "#0066CC",
                          }}
                        >
                          {t("inProgress")}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
