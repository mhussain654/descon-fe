import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  User,
  FileText,
  CheckCircle,
  Flag,
  Globe,
  LogOut,
  ChevronRight,
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
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState } from "../../../design-system";
import { humanizeStatusCode } from "../../../../../shared/candidateProfile/formatting";
import { CANDIDATE_PROFILE_ERROR_KEYS } from "../../../../../shared/candidateProfile/errorMessages";
import {
  APPLICATION_SUBMISSION_STATE_KEYS,
  APPLICATION_SUBMISSION_STATE_TONES,
} from "../../../../../shared/applicationProgress/statusLabels";

const TONE_COLORS = {
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#0066CC",
  neutral: "#6B7280",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, toggleLanguage, language } = useLanguage();
  const { logout } = useAuth();
  const profileQuery = useCandidateProfile();
  const progressQuery = useApplicationProgress();
  useRefetchOnFocus(profileQuery.refetch, profileQuery.isFetching);
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  const InfoRow = ({ icon: Icon, iconColor, label, value }) => (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#333333" : "#F0F0F0",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
          justifyContent: "center",
          alignItems: "center",
          marginEnd: 12,
        }}
      >
        <Icon size={20} color={iconColor ?? (isDark ? "#9CA3AF" : "#6B7280")} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Inter_500Medium",
            color: isDark ? "#FFFFFF" : "#000000",
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );

  const profile = profileQuery.data;
  const notAssignedYet = t("candidateProfileNotAssignedYet");
  const documents = progressQuery.data?.documents;

  const renderBody = () => {
    if (profileQuery.isLoading) {
      return <LoadingState message={t("loading")} />;
    }
    const error = profileQuery.error;
    if (error?.code === "SESSION_EXPIRED") {
      return (
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
        />
      );
    }
    if (error?.code === "INACTIVE_ACCOUNT") {
      return (
        <ForbiddenState
          title={t("candidateProfileInactiveAccountTitle")}
          description={t("candidateProfileInactiveAccountDescription")}
          actionLabel={t("candidateProfileInactiveAccountAction")}
          onAction={returnToSignIn}
        />
      );
    }
    if (error?.code === "OFFLINE") {
      return (
        <OfflineState
          title={t("dsOfflineTitle")}
          description={t("dsOfflineDescription")}
          retryLabel={t("retry")}
          onRetry={() => profileQuery.refetch()}
        />
      );
    }
    if (error) {
      return (
        <ErrorState
          message={t(CANDIDATE_PROFILE_ERROR_KEYS[error.code])}
          retryLabel={t("retry")}
          onRetry={() => profileQuery.refetch()}
        />
      );
    }
    if (!profile) {
      return <ErrorState message={t("somethingWentWrong")} retryLabel={t("retry")} onRetry={() => profileQuery.refetch()} />;
    }

    return (
      <>
        {/* Profile Header */}
        <View
          style={{
            backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            alignItems: "center",
            borderWidth: 1,
            borderColor: isDark ? "#333333" : "#E5E7EB",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#0066CC",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 32, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" }}>
              {profile.fullName.charAt(0)}
            </Text>
          </View>
          <Text style={{ fontSize: 20, fontFamily: "Inter_600SemiBold", color: isDark ? "#FFFFFF" : "#000000", marginBottom: 4 }}>
            {profile.fullName}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280" }}>
            {profile.referenceNumber ?? notAssignedYet}
          </Text>
        </View>

        {/* Personal Information */}
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
          <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: isDark ? "#FFFFFF" : "#000000", marginBottom: 16 }}>
            {t("personalInfo")}
          </Text>

          <InfoRow icon={User} label={t("candidateProfileMaskedCnicLabel")} value={profile.maskedCnic} />
          <InfoRow icon={FileText} label={t("candidateProfileReferenceNumberLabel")} value={profile.referenceNumber ?? notAssignedYet} />
          <InfoRow icon={CheckCircle} label={t("candidateProfileStatusLabel")} value={humanizeStatusCode(profile.candidateStatus)} />
          <InfoRow
            icon={Flag}
            label={t("candidateProfileWorkflowStageLabel")}
            value={profile.currentWorkflowStage?.name ?? notAssignedYet}
          />
          {documents ? (
            <InfoRow
              icon={CheckCircle}
              iconColor={TONE_COLORS[APPLICATION_SUBMISSION_STATE_TONES[documents.submissionState]]}
              label={t("candidateProfileDocumentsSectionTitle")}
              value={t(APPLICATION_SUBMISSION_STATE_KEYS[documents.submissionState])}
            />
          ) : null}
        </View>
      </>
    );
  };

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
        <Text style={{ fontSize: 28, fontFamily: "Inter_600SemiBold", color: isDark ? "#FFFFFF" : "#000000" }}>
          {t("profile")}
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
          <RefreshControl
            refreshing={profileQuery.isRefetching || progressQuery.isRefetching}
            onRefresh={() => {
              profileQuery.refetch();
              progressQuery.refetch();
            }}
            title={t("pullToRefresh")}
          />
        }
      >
        {renderBody()}

        {/* Settings */}
        <View
          style={{
            backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
            borderRadius: 16,
            padding: 4,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: isDark ? "#333333" : "#E5E7EB",
          }}
        >
          <Pressable
            onPress={toggleLanguage}
            accessibilityRole="button"
            accessibilityLabel={t("language")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              backgroundColor: pressed ? (isDark ? "#333333" : "#F6F6F6") : "transparent",
              borderRadius: 12,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark ? "#1A2B3D" : "#E6F2FF",
                justifyContent: "center",
                alignItems: "center",
                marginEnd: 12,
              }}
            >
              <Globe size={20} color="#0066CC" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: isDark ? "#FFFFFF" : "#000000" }}>
                {t("language")}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: isDark ? "#9CA3AF" : "#6B7280", marginTop: 2 }}>
                {language === "en" ? t("englishLabel") : t("urduLabel")}
              </Text>
            </View>
            <ChevronRight size={20} color={isDark ? "#6B7280" : "#9CA3AF"} />
          </Pressable>
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel={t("logout")}
          style={{
            backgroundColor: isDark ? "#2D1B1B" : "#FEF2F2",
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: isDark ? "#4B2626" : "#FEE2E2",
          }}
        >
          <LogOut size={20} color="#EF4444" />
          <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#EF4444", marginStart: 8 }}>
            {t("logout")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
