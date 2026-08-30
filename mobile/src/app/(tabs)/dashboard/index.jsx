import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  FileText,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { useCandidateProfile } from "../../../features/candidate/profile/hooks/useCandidateProfile";
import { useCandidateDocuments } from "../../../features/candidate/documents/hooks/useCandidateDocuments";
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { resolveNextAction, NEXT_ACTION_KEYS } from "../../../../../shared/applicationProgress/nextAction";
import { currentDashboardStage } from "../../../../../shared/applicationProgress/currentDashboardStage";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState } from "../../../design-system";
import { CANDIDATE_PROFILE_ERROR_KEYS } from "../../../../../shared/candidateProfile/errorMessages";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../../shared/candidateDocuments/errorMessages";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../../shared/applicationProgress/errorMessages";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useLanguage();
  const { logout } = useAuth();
  const profileQuery = useCandidateProfile();
  const checklistQuery = useCandidateDocuments();
  const progressQuery = useApplicationProgress();
  useRefetchOnFocus(profileQuery.refetch, profileQuery.isFetching);
  useRefetchOnFocus(checklistQuery.refetch, checklistQuery.isFetching);
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  // `isRefreshing` state alone isn't a reliable re-entry guard: two calls to
  // `handleRefresh` that both start before React commits the first
  // `setIsRefreshing(true)` would both close over the same stale `false` and
  // both proceed. A ref is read/written synchronously, so the second call
  // always sees the first call's lock regardless of render timing.
  const isRefreshingRef = useRef(false);
  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await Promise.all([profileQuery.refetch(), checklistQuery.refetch(), progressQuery.refetch()]);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [profileQuery.refetch, checklistQuery.refetch, progressQuery.refetch]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  // Dashboard composes 3 independent queries (profile, checklist, progress)
  // -- a SESSION_EXPIRED/INACTIVE_ACCOUNT from *any* of them must win over a
  // merely transient error (offline/network/server) from another, or the
  // candidate would see a "Retry" button instead of the screen that actually
  // ends/protects an invalid session. Only once no source query reports a
  // session-ending error do we fall back to picking the first real error in
  // priority order (profile identity first, since nothing else can render
  // meaningfully without it), matching Documents/Status/Profile's own
  // per-query dedicated states instead of silently leaving the header blank
  // or the status card stuck at "0%" (indistinguishable from valid empty
  // data).
  const errorSources = [
    { error: profileQuery.error, keys: CANDIDATE_PROFILE_ERROR_KEYS },
    { error: checklistQuery.error, keys: CANDIDATE_DOCUMENTS_ERROR_KEYS },
    { error: progressQuery.error, keys: APPLICATION_PROGRESS_ERROR_KEYS },
  ];
  const primarySource =
    errorSources.find((source) => source.error?.code === "SESSION_EXPIRED" || source.error?.code === "INACTIVE_ACCOUNT") ??
    errorSources.find((source) => source.error);
  const primaryError = primarySource?.error ?? null;
  const primaryErrorKeys = primarySource?.keys ?? CANDIDATE_PROFILE_ERROR_KEYS;
  const isLoading = profileQuery.isLoading || checklistQuery.isLoading || progressQuery.isLoading;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <LoadingState message={t("loading")} />
      </View>
    );
  }
  if (primaryError?.code === "SESSION_EXPIRED") {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
        />
      </View>
    );
  }
  if (primaryError?.code === "INACTIVE_ACCOUNT") {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ForbiddenState
          title={t("candidateProfileInactiveAccountTitle")}
          description={t("candidateProfileInactiveAccountDescription")}
          actionLabel={t("candidateProfileInactiveAccountAction")}
          onAction={returnToSignIn}
        />
      </View>
    );
  }
  if (primaryError?.code === "OFFLINE") {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <OfflineState
          title={t("dsOfflineTitle")}
          description={t("dsOfflineDescription")}
          retryLabel={t("retry")}
          onRetry={handleRefresh}
        />
      </View>
    );
  }
  if (primaryError) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ErrorState message={t(primaryErrorKeys[primaryError.code])} retryLabel={t("retry")} onRetry={handleRefresh} />
      </View>
    );
  }
  if (!profileQuery.data || !progressQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ErrorState message={t("somethingWentWrong")} retryLabel={t("retry")} onRetry={handleRefresh} />
      </View>
    );
  }

  const documents = progressQuery.data?.documents;
  const workflow = progressQuery.data?.workflow;
  const isVerified = documents?.submissionState === "verified";
  // The real, backend-authoritative workflow (MPS-501) -- `currentWorkflowStage`
  // is a separate, HR-advanced pipeline position that can legitimately lag
  // behind it, so summarizing "current status" here from the same timeline
  // Status renders keeps the two screens telling the same story.
  const currentStage = workflow ? currentDashboardStage(workflow.timeline) : null;
  const currentStageName = currentStage
    ? `${currentStage.name}${currentStage.inProgress ? ` (${t("inProgress")})` : ""}`
    : null;
  const nextAction =
    progressQuery.data && checklistQuery.data ? resolveNextAction(progressQuery.data, checklistQuery.data) : null;
  const nextActionMessage = nextAction
    ? `${t(NEXT_ACTION_KEYS[nextAction.kind])}${nextAction.requirementName ? `: ${nextAction.requirementName}` : ""}`
    : t("waitingForVerification");

  const quickActions = [
    {
      icon: FileText,
      label: t("uploadDocuments"),
      color: "#0066CC",
      bgColor: isDark ? "#1A2B3D" : "#E6F2FF",
      onPress: () => router.push("/(tabs)/documents"),
    },
    {
      icon: CreditCard,
      label: t("makePayment"),
      subLabel: t("makePaymentComingSoon"),
      color: "#10B981",
      bgColor: isDark ? "#1A2E1A" : "#E6F9F0",
      disabled: true,
      onPress: undefined,
    },
    {
      icon: Clock,
      label: t("viewStatus"),
      color: "#F59E0B",
      bgColor: isDark ? "#2E2416" : "#FFF7E6",
      onPress: () => router.push("/(tabs)/status"),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 20,
          backgroundColor: isDark ? "#121212" : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#333333" : "#F0F0F0",
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginBottom: 4,
          }}
        >
          {t("welcome")}
        </Text>
        <Text
          style={{
            fontSize: 24,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#FFFFFF" : "#000000",
          }}
        >
          {profileQuery.data.fullName}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginTop: 2,
          }}
        >
          {profileQuery.data.referenceNumber ?? t("candidateProfileNotAssignedYet")}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 80,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} title={t("pullToRefresh")} />
        }
      >
        {/* Current Status Card */}
        <View
          style={{
            backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: isDark ? "#333333" : "#E5E7EB",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: "Inter_600SemiBold",
                color: isDark ? "#FFFFFF" : "#000000",
              }}
            >
              {t("currentStatus")}
            </Text>
            {isVerified ? (
              <View style={{ backgroundColor: isDark ? "#1A2E1A" : "#E6F9F0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#10B981" }}>{t("verified")}</Text>
              </View>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <CheckCircle size={20} color="#0066CC" />
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Inter_500Medium",
                color: isDark ? "#FFFFFF" : "#000000",
                marginStart: 10,
              }}
            >
              {currentStageName ?? t("registered")}
            </Text>
          </View>

          {/* Progress Bar */}
          <View
            style={{
              height: 8,
              backgroundColor: isDark ? "#333333" : "#E5E7EB",
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${workflow?.progressPercentage ?? 0}%`,
                backgroundColor: "#0066CC",
                borderRadius: 4,
              }}
            />
          </View>

          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_400Regular",
              color: isDark ? "#9CA3AF" : "#6B7280",
            }}
          >
            {workflow?.progressPercentage ?? 0}% {t("complete")}
          </Text>
        </View>

        {/* Next Steps */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_600SemiBold",
              color: isDark ? "#FFFFFF" : "#000000",
              marginBottom: 12,
            }}
          >
            {t("nextSteps")}
          </Text>

          <View
            style={{
              backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: isDark ? "#333333" : "#E5E7EB",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <AlertCircle size={20} color="#F59E0B" />
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontFamily: "Inter_400Regular",
                color: isDark ? "#FFFFFF" : "#000000",
                marginStart: 12,
              }}
            >
              {nextActionMessage}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View>
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_600SemiBold",
              color: isDark ? "#FFFFFF" : "#000000",
              marginBottom: 12,
            }}
          >
            {t("quickActions")}
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
            }}
          >
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={action.onPress}
                disabled={action.disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!action.disabled }}
                style={{
                  width: "50%",
                  paddingHorizontal: 6,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    backgroundColor: action.bgColor,
                    borderRadius: 12,
                    padding: 20,
                    alignItems: "center",
                    opacity: action.disabled ? 0.5 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: action.color,
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <action.icon size={24} color="#FFFFFF" />
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: "Inter_500Medium",
                      color: isDark ? "#FFFFFF" : "#000000",
                      textAlign: "center",
                    }}
                  >
                    {action.label}
                  </Text>
                  {action.subLabel ? (
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                        color: isDark ? "#9CA3AF" : "#6B7280",
                        textAlign: "center",
                        marginTop: 2,
                      }}
                    >
                      {action.subLabel}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
