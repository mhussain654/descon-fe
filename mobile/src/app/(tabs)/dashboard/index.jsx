import { useEffect } from "react";
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

  // Dashboard composes 3 independent queries with no dedicated error layout
  // of its own (the prototype has none) -- a session-ending error from any
  // of them still has to end the session, matching every other candidate
  // screen's behavior, even though a transient network/server error here
  // just leaves that section showing its loading fallback rather than a
  // full error card (Documents/Status/Profile each already own that).
  // Placed above the `fontsLoaded` early return below -- every hook here
  // must run on every render regardless of that gate, or React sees a
  // different hook order between the "still loading fonts" render and every
  // render after it (Rules of Hooks).
  useEffect(() => {
    const code = profileQuery.error?.code ?? checklistQuery.error?.code ?? progressQuery.error?.code;
    if (code === "SESSION_EXPIRED" || code === "INACTIVE_ACCOUNT") {
      returnToSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.error, checklistQuery.error, progressQuery.error]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
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
      color: "#10B981",
      bgColor: isDark ? "#1A2E1A" : "#E6F9F0",
      onPress: () => {},
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
          {profileQuery.data?.fullName ?? " "}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginTop: 2,
          }}
        >
          {profileQuery.data?.referenceNumber ?? ""}
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
          <RefreshControl
            refreshing={profileQuery.isRefetching || checklistQuery.isRefetching || progressQuery.isRefetching}
            onRefresh={() => {
              profileQuery.refetch();
              checklistQuery.refetch();
              progressQuery.refetch();
            }}
            title={t("pullToRefresh")}
          />
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
                marginLeft: 10,
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
                marginLeft: 12,
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
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
