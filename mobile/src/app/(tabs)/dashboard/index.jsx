import {
  View,
  Text,
  ScrollView,
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
import { useLanguage } from "../../../contexts/LanguageContext";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useLanguage();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  // Stub data
  const candidateData = {
    name: "Ahmed Khan",
    regNumber: "DES-2024-001",
    currentStage: "Documents Uploaded",
    progress: 30,
    documentsStatus: "pending_verification",
    paymentStatus: "pending",
  };

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
      disabled: candidateData.paymentStatus === "pending",
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
          {candidateData.name}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_400Regular",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginTop: 2,
          }}
        >
          {candidateData.regNumber}
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
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_600SemiBold",
              color: isDark ? "#FFFFFF" : "#000000",
              marginBottom: 16,
            }}
          >
            {t("currentStatus")}
          </Text>

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
              {candidateData.currentStage}
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
                width: `${candidateData.progress}%`,
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
            {candidateData.progress}% Complete
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
              Waiting for document verification by HR team
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
            Quick Actions
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
