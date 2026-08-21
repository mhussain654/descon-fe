import { View, Text, ScrollView, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CheckCircle, Circle, Clock } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useLanguage } from "../../../contexts/LanguageContext";

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
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

  // Stub timeline data
  const timeline = [
    { id: 1, label: t("registered"), status: "completed", date: "2024-01-10" },
    {
      id: 2,
      label: t("documentsPending"),
      status: "completed",
      date: "2024-01-12",
    },
    {
      id: 3,
      label: t("documentsUploaded"),
      status: "current",
      date: "2024-01-16",
    },
    { id: 4, label: t("documentsVerified"), status: "pending", date: null },
    { id: 5, label: t("feePending"), status: "pending", date: null },
    { id: 6, label: t("feePaid"), status: "pending", date: null },
    { id: 7, label: t("sharedWithBU"), status: "pending", date: null },
    { id: 8, label: t("qvcBooked"), status: "pending", date: null },
    { id: 9, label: t("qvcOutcome"), status: "pending", date: null },
    { id: 10, label: t("visaIssued"), status: "pending", date: null },
    { id: 11, label: t("protectionCompleted"), status: "pending", date: null },
    { id: 12, label: t("readyToFly"), status: "pending", date: null },
    {
      id: 13,
      label: t("flightDetailsUploaded"),
      status: "pending",
      date: null,
    },
    { id: 14, label: t("mobilized"), status: "pending", date: null },
  ];

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
      >
        {/* Timeline */}
        <View>
          {timeline.map((item, index) => {
            const config = getStatusConfig(item.status);
            const StatusIcon = config.icon;
            const isLast = index === timeline.length - 1;

            return (
              <View key={item.id} style={{ flexDirection: "row" }}>
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
                      fill={
                        item.status === "completed" ? config.iconColor : "none"
                      }
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
                      fontFamily:
                        item.status === "current"
                          ? "Inter_600SemiBold"
                          : "Inter_500Medium",
                      color: config.textColor,
                      marginBottom: 2,
                    }}
                  >
                    {item.label}
                  </Text>
                  {item.date && (
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: "Inter_400Regular",
                        color: isDark ? "#6B7280" : "#9CA3AF",
                      }}
                    >
                      {item.date}
                    </Text>
                  )}
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
                        In Progress
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
