import { View, ScrollView, RefreshControl, TouchableOpacity, Pressable, useColorScheme } from "react-native";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { LogOut, Globe, ChevronRight } from "lucide-react-native";
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
import { CandidateProfileView } from "../../../features/candidate/profile/components/CandidateProfileView";

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

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

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
          }}
        >
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
        <CandidateProfileView
          isLoading={profileQuery.isLoading}
          error={profileQuery.error ?? null}
          profile={profileQuery.data}
          documents={progressQuery.data?.documents}
          t={t}
          onRetry={() => profileQuery.refetch()}
          onReturnToSignIn={returnToSignIn}
        />

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
                marginRight: 12,
              }}
            >
              <Globe size={20} color="#0066CC" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Inter_500Medium",
                  color: isDark ? "#FFFFFF" : "#000000",
                }}
              >
                {t("language")}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: isDark ? "#9CA3AF" : "#6B7280",
                  marginTop: 2,
                }}
              >
                {language === "en" ? t("englishLabel") : t("urduLabel")}
              </Text>
            </View>
            <ChevronRight size={20} color={isDark ? "#6B7280" : "#9CA3AF"} />
          </Pressable>
        </View>

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
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_600SemiBold",
              color: "#EF4444",
              marginLeft: 8,
            }}
          >
            {t("logout")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
