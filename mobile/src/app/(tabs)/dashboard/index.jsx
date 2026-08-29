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
import { FileText, CreditCard, Clock, AlertCircle } from "lucide-react-native";
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
import { ApplicationProgressSummary } from "../../../features/candidate/progress/components/ApplicationProgressSummary";
import { resolveNextAction, NEXT_ACTION_KEYS } from "../../../../../shared/applicationProgress/nextAction";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useLanguage();
  const { logout } = useAuth();
  const profileQuery = useCandidateProfile();
  const checklistQuery = useCandidateDocuments();
  // Shares its query cache with ApplicationProgressSummary's own
  // useApplicationProgress() call below -- no extra request, just gives
  // this screen access to the data resolveNextAction() needs.
  const progressQuery = useApplicationProgress();
  useRefetchOnFocus(profileQuery.refetch, profileQuery.isFetching);
  useRefetchOnFocus(checklistQuery.refetch, checklistQuery.isFetching);
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

  const nextAction =
    progressQuery.data && checklistQuery.data ? resolveNextAction(progressQuery.data, checklistQuery.data) : null;

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
        <ApplicationProgressSummary onReturnToSignIn={returnToSignIn} />

        {nextAction ? (
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: "Inter_600SemiBold",
                color: isDark ? "#FFFFFF" : "#000000",
                marginBottom: 12,
              }}
            >
              {t("applicationProgressNextActionTitle")}
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
                {t(NEXT_ACTION_KEYS[nextAction.kind])}
                {nextAction.requirementName ? `: ${nextAction.requirementName}` : ""}
              </Text>
            </View>
          </View>
        ) : null}

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
