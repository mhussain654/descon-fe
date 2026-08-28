import { View, Text, ScrollView, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCandidateDocuments } from "../../../features/candidate/documents/hooks/useCandidateDocuments";
import { DocumentChecklistView } from "../../../features/candidate/documents/components/DocumentChecklistView";
import { ApplicationProgressSummary } from "../../../features/candidate/progress/components/ApplicationProgressSummary";

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const checklistQuery = useCandidateDocuments();

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
          {t("documents")}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#9CA3AF" : "#6B7280",
          }}
        >
          {t("candidateDocumentsSubtitle")}
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
      >
        <ApplicationProgressSummary onReturnToSignIn={returnToSignIn} />

        <DocumentChecklistView
          isLoading={checklistQuery.isLoading}
          error={checklistQuery.error ?? null}
          checklist={checklistQuery.data}
          language={language}
          t={t}
          onRetry={() => checklistQuery.refetch()}
          onReturnToSignIn={returnToSignIn}
        />
      </ScrollView>
    </View>
  );
}
