import { View, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { useCandidateProfile } from "../../../features/candidate/profile/hooks/useCandidateProfile";
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { ProfileHeader, ProfileDetails, ProfileSettings, profileStyles } from "../../../features/candidate/profile/components/ProfilePresentation";
import { LoadingState, ErrorState, OfflineState, SessionExpiredState, ForbiddenState } from "../../../design-system";
import { ButtonHeightContext } from "../../../design-system/Button";
import { CANDIDATE_PROFILE_ERROR_KEYS } from "../../../../../shared/candidateProfile/errorMessages";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, toggleLanguage, language } = useLanguage();
  const { logout } = useAuth();
  const profileQuery = useCandidateProfile();
  const progressQuery = useApplicationProgress();
  useRefetchOnFocus(profileQuery.refetch, profileQuery.isFetching);
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  const profile = profileQuery.data;
  const documents = progressQuery.data?.documents;

  const renderBody = () => {
    // isPending, not isLoading -- see documents/index.jsx for why a disabled
    // (auth still restoring) query needs this, not isLoading.
    if (profileQuery.isPending) {
      return <LoadingState message={t("loading")} language={language} />;
    }
    const error = profileQuery.error;
    if (error?.code === "SESSION_EXPIRED") {
      return (
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
          language={language}
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
          language={language}
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
          language={language}
        />
      );
    }
    if (error) {
      return (
        <ErrorState
          message={t(CANDIDATE_PROFILE_ERROR_KEYS[error.code])}
          retryLabel={t("retry")}
          onRetry={() => profileQuery.refetch()}
          language={language}
        />
      );
    }
    if (!profile) {
      return (
        <ErrorState
          message={t("somethingWentWrong")}
          retryLabel={t("retry")}
          onRetry={() => profileQuery.refetch()}
          language={language}
        />
      );
    }

    return <ProfileDetails profile={profile} documents={documents} language={language} t={t} />;
  };

  return (
    <ButtonHeightContext.Provider value={34}>
      <View style={profileStyles.screen}>
        <StatusBar style="light" />
        <ProfileHeader profile={profile} topInset={insets.top} language={language} t={t} />
        <ScrollView
          style={profileStyles.scroll}
          contentContainerStyle={[profileStyles.content, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={profileQuery.isRefetching || progressQuery.isRefetching} onRefresh={() => { profileQuery.refetch(); progressQuery.refetch(); }} title={t("pullToRefresh")} />}
        >
          {renderBody()}
          <ProfileSettings language={language} t={t} onLanguageChange={toggleLanguage} onLogout={handleLogout} />
        </ScrollView>
      </View>
    </ButtonHeightContext.Provider>
  );
}
