import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  User,
  Phone,
  Mail,
  MapPin,
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, toggleLanguage, language } = useLanguage();
  const { logout } = useAuth();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  // Stub profile data
  const profileData = {
    name: "Ahmed Khan",
    cnic: "12345-1234567-1",
    regNumber: "DES-2024-001",
    phone: "+92 300 1234567",
    email: "ahmed.khan@example.com",
    address: "Lahore, Pakistan",
  };

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const InfoRow = ({ icon: Icon, label, value }) => (
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
          marginRight: 12,
        }}
      >
        <Icon size={20} color={isDark ? "#9CA3AF" : "#6B7280"} />
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
      >
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
            <Text
              style={{
                fontSize: 32,
                fontFamily: "Inter_600SemiBold",
                color: "#FFFFFF",
              }}
            >
              {profileData.name.charAt(0)}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 20,
              fontFamily: "Inter_600SemiBold",
              color: isDark ? "#FFFFFF" : "#000000",
              marginBottom: 4,
            }}
          >
            {profileData.name}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter_400Regular",
              color: isDark ? "#9CA3AF" : "#6B7280",
            }}
          >
            {profileData.regNumber}
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
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_600SemiBold",
              color: isDark ? "#FFFFFF" : "#000000",
              marginBottom: 16,
            }}
          >
            {t("personalInfo")}
          </Text>

          <InfoRow icon={User} label={t("cnicShort")} value={profileData.cnic} />
          <InfoRow icon={Phone} label={t("phoneShort")} value={profileData.phone} />
          <InfoRow icon={Mail} label={t("emailShort")} value={profileData.email} />
          <InfoRow icon={MapPin} label={t("addressShort")} value={profileData.address} />
        </View>

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
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              backgroundColor: pressed
                ? isDark
                  ? "#333333"
                  : "#F6F6F6"
                : "transparent",
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

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
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
