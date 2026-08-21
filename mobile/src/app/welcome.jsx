import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useLanguage } from "../contexts/LanguageContext";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();

  const [fontsLoaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded && !error) {
    return null;
  }

  const handleContinue = () => {
    router.replace("/login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar style="dark" />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 60,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <Image
            source={{
              uri: "https://ucarecdn.com/26b1d36a-12cf-4efa-853d-08da75f95d7e/-/format/auto/",
            }}
            style={{ width: 160, height: 60 }}
            contentFit="contain"
          />
        </View>

        {/* Welcome Message */}
        <View style={{ marginBottom: 48 }}>
          <Text
            style={{
              fontSize: 32,
              fontFamily: "Inter_600SemiBold",
              color: "#000000",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            {t("welcomeTitle")}
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_400Regular",
              color: "#6B7280",
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            {t("welcomeMessage")}
          </Text>
        </View>

        {/* Language Selection */}
        <View style={{ marginBottom: 48 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter_500Medium",
              color: "#000000",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {t("selectLanguage")}
          </Text>

          <View style={{ gap: 12 }}>
            {/* English */}
            <TouchableOpacity
              onPress={() => setLanguage("en")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: language === "en" ? "#F0F9FF" : "#F6F6F6",
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 18,
                borderWidth: 2,
                borderColor: language === "en" ? "#0066CC" : "#E5E7EB",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 24,
                    marginRight: 12,
                  }}
                >
                  🇬🇧
                </Text>
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Inter_600SemiBold",
                      color: "#000000",
                    }}
                  >
                    English
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: "Inter_400Regular",
                      color: "#6B7280",
                    }}
                  >
                    Continue in English
                  </Text>
                </View>
              </View>
              {language === "en" && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "#0066CC",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            {/* Urdu */}
            <TouchableOpacity
              onPress={() => setLanguage("ur")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: language === "ur" ? "#F0F9FF" : "#F6F6F6",
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 18,
                borderWidth: 2,
                borderColor: language === "ur" ? "#0066CC" : "#E5E7EB",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 24,
                    marginRight: 12,
                  }}
                >
                  🇵🇰
                </Text>
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Inter_600SemiBold",
                      color: "#000000",
                    }}
                  >
                    اردو
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: "Inter_400Regular",
                      color: "#6B7280",
                    }}
                  >
                    اردو میں جاری رکھیں
                  </Text>
                </View>
              </View>
              {language === "ur" && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "#0066CC",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          style={{
            backgroundColor: "#0066CC",
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
            shadowColor: "#0066CC",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_600SemiBold",
              color: "#FFFFFF",
            }}
          >
            {t("continue")}
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Inter_400Regular",
            color: "#9CA3AF",
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Descon Engineering Limited
        </Text>
      </View>
    </View>
  );
}
