import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useLanguage } from "../../../contexts/LanguageContext";

export default function DocumentsScreen() {
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

  // Stub document data
  const documents = [
    {
      id: 1,
      name: t("passport"),
      status: "verified",
      uploadDate: "2024-01-15",
    },
    {
      id: 2,
      name: t("cnicFront"),
      status: "verified",
      uploadDate: "2024-01-15",
    },
    {
      id: 3,
      name: t("cnicBack"),
      status: "verified",
      uploadDate: "2024-01-15",
    },
    {
      id: 4,
      name: t("nextOfKinCNIC"),
      status: "uploaded",
      uploadDate: "2024-01-16",
    },
    {
      id: 5,
      name: t("policeCharacter"),
      status: "uploaded",
      uploadDate: "2024-01-16",
    },
    { id: 6, name: t("bankDetails"), status: "pending", uploadDate: null },
    { id: 7, name: t("chequeImage"), status: "pending", uploadDate: null },
    {
      id: 8,
      name: t("cv"),
      status: "rejected",
      uploadDate: "2024-01-14",
      reason: t("poorQualityImage"),
    },
    { id: 9, name: t("experienceLetter"), status: "pending", uploadDate: null },
    { id: 10, name: t("certificates"), status: "pending", uploadDate: null },
    {
      id: 11,
      name: t("polioCertificate"),
      status: "pending",
      uploadDate: null,
    },
  ];

  const getStatusConfig = (status) => {
    switch (status) {
      case "verified":
        return {
          icon: CheckCircle,
          color: "#10B981",
          bgColor: isDark ? "#1A2E1A" : "#E6F9F0",
          label: t("verified"),
        };
      case "uploaded":
        return {
          icon: Clock,
          color: "#F59E0B",
          bgColor: isDark ? "#2E2416" : "#FFF7E6",
          label: t("uploaded"),
        };
      case "rejected":
        return {
          icon: XCircle,
          color: "#EF4444",
          bgColor: isDark ? "#2D1B1B" : "#FEF2F2",
          label: t("rejected"),
        };
      default:
        return {
          icon: Upload,
          color: "#6B7280",
          bgColor: isDark ? "#1E1E1E" : "#F6F6F6",
          label: t("pending"),
        };
    }
  };

  const stats = {
    verified: documents.filter((d) => d.status === "verified").length,
    uploaded: documents.filter((d) => d.status === "uploaded").length,
    pending: documents.filter((d) => d.status === "pending").length,
    rejected: documents.filter((d) => d.status === "rejected").length,
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
          }}
        >
          {t("documents")}
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
        {/* Stats */}
        <View
          style={{
            flexDirection: "row",
            marginBottom: 20,
            marginHorizontal: -4,
          }}
        >
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <View
              style={{
                backgroundColor: isDark ? "#1A2E1A" : "#E6F9F0",
                borderRadius: 12,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontFamily: "Inter_600SemiBold",
                  color: "#10B981",
                  marginBottom: 2,
                }}
              >
                {stats.verified}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: isDark ? "#FFFFFF" : "#000000",
                }}
              >
                {t("verified")}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <View
              style={{
                backgroundColor: isDark ? "#2E2416" : "#FFF7E6",
                borderRadius: 12,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontFamily: "Inter_600SemiBold",
                  color: "#F59E0B",
                  marginBottom: 2,
                }}
              >
                {stats.uploaded}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: isDark ? "#FFFFFF" : "#000000",
                }}
              >
                {t("uploaded")}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <View
              style={{
                backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
                borderRadius: 12,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontFamily: "Inter_600SemiBold",
                  color: "#6B7280",
                  marginBottom: 2,
                }}
              >
                {stats.pending}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_400Regular",
                  color: isDark ? "#FFFFFF" : "#000000",
                }}
              >
                {t("pending")}
              </Text>
            </View>
          </View>
        </View>

        {/* Document List */}
        <View>
          {documents.map((doc) => {
            const statusConfig = getStatusConfig(doc.status);
            const StatusIcon = statusConfig.icon;

            return (
              <TouchableOpacity
                key={doc.id}
                style={{
                  backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "#333333" : "#E5E7EB",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: statusConfig.bgColor,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <StatusIcon size={20} color={statusConfig.color} />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: "Inter_500Medium",
                        color: isDark ? "#FFFFFF" : "#000000",
                        marginBottom: 2,
                      }}
                    >
                      {doc.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: "Inter_400Regular",
                        color: statusConfig.color,
                      }}
                    >
                      {statusConfig.label}
                      {doc.uploadDate && ` • ${doc.uploadDate}`}
                    </Text>
                    {doc.reason && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Inter_400Regular",
                          color: "#EF4444",
                          marginTop: 4,
                        }}
                      >
                        {doc.reason}
                      </Text>
                    )}
                  </View>

                  <ChevronRight
                    size={20}
                    color={isDark ? "#6B7280" : "#9CA3AF"}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
