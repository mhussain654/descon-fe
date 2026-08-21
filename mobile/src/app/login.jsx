import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ArrowLeft, Shield } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useLanguage } from "../contexts/LanguageContext";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useLanguage();

  const [step, setStep] = useState(1); // 1 = mobile/cnic, 2 = otp
  const [cnic, setCnic] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const [fontsLoaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded && !error) {
    return null;
  }

  const handleSendOTP = async () => {
    if (!cnic || !mobileNumber) {
      return;
    }
    setLoading(true);
    // Simulate OTP sending
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1500);
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      return;
    }
    setLoading(true);
    // Simulate OTP verification
    setTimeout(() => {
      setLoading(false);
      router.replace("/(tabs)/dashboard");
    }, 1500);
  };

  const handleResendOTP = async () => {
    setLoading(true);
    // Simulate resending OTP
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  };

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#FFFFFF" }}
      behavior="padding"
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Back Button (only on step 2) */}
      {step === 2 && (
        <TouchableOpacity
          onPress={() => setStep(1)}
          style={{
            position: "absolute",
            top: insets.top + 16,
            left: 20,
            zIndex: 10,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ArrowLeft size={20} color={isDark ? "#FFFFFF" : "#000000"} />
        </TouchableOpacity>
      )}

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 80,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {/* Logo & Title */}
        <View style={{ marginBottom: 48 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: "#0066CC",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <Shield size={32} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text
            style={{
              fontSize: 28,
              fontFamily: "Inter_600SemiBold",
              color: isDark ? "#FFFFFF" : "#000000",
              marginBottom: 8,
            }}
          >
            {step === 1 ? t("login") : t("verifyOTP")}
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_400Regular",
              color: isDark ? "#9CA3AF" : "#6B7280",
              lineHeight: 22,
            }}
          >
            {step === 1
              ? t("loginMessage")
              : t("otpSentMessage") + " " + mobileNumber}
          </Text>
        </View>

        {/* Step 1: Mobile Number & CNIC */}
        {step === 1 && (
          <>
            <View style={{ marginBottom: 32 }}>
              {/* Mobile Number */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_500Medium",
                    color: isDark ? "#FFFFFF" : "#000000",
                    marginBottom: 8,
                  }}
                >
                  {t("mobileNumber")}
                </Text>
                <TextInput
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  placeholder={t("enterMobileNumber")}
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                  keyboardType="phone-pad"
                  style={{
                    backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    fontFamily: "Inter_400Regular",
                    color: isDark ? "#FFFFFF" : "#000000",
                    borderWidth: 1,
                    borderColor: isDark ? "#333333" : "#E5E7EB",
                  }}
                />
              </View>

              {/* CNIC */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_500Medium",
                    color: isDark ? "#FFFFFF" : "#000000",
                    marginBottom: 8,
                  }}
                >
                  {t("cnic")}
                </Text>
                <TextInput
                  value={cnic}
                  onChangeText={setCnic}
                  placeholder={t("enterCNIC")}
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    fontFamily: "Inter_400Regular",
                    color: isDark ? "#FFFFFF" : "#000000",
                    borderWidth: 1,
                    borderColor: isDark ? "#333333" : "#E5E7EB",
                  }}
                />
              </View>
            </View>

            {/* Send OTP Button */}
            <TouchableOpacity
              onPress={handleSendOTP}
              disabled={loading || !cnic || !mobileNumber}
              style={{
                backgroundColor:
                  loading || !cnic || !mobileNumber ? "#9CA3AF" : "#0066CC",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "Inter_600SemiBold",
                    color: "#FFFFFF",
                  }}
                >
                  {t("sendOTP")}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <>
            <View style={{ marginBottom: 32 }}>
              {/* OTP Input */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_500Medium",
                    color: isDark ? "#FFFFFF" : "#000000",
                    marginBottom: 8,
                  }}
                >
                  {t("enterOTP")}
                </Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={{
                    backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 24,
                    fontFamily: "Inter_600SemiBold",
                    color: isDark ? "#FFFFFF" : "#000000",
                    borderWidth: 1,
                    borderColor: isDark ? "#333333" : "#E5E7EB",
                    letterSpacing: 8,
                    textAlign: "center",
                  }}
                />
              </View>

              {/* Resend OTP */}
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={loading}
                style={{ alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_500Medium",
                    color: "#0066CC",
                  }}
                >
                  {t("resendOTP")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Verify OTP Button */}
            <TouchableOpacity
              onPress={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              style={{
                backgroundColor:
                  loading || otp.length !== 6 ? "#9CA3AF" : "#0066CC",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "Inter_600SemiBold",
                    color: "#FFFFFF",
                  }}
                >
                  {t("verifyAndLogin")}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Footer */}
        <View style={{ marginTop: 32, alignItems: "center" }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_400Regular",
              color: isDark ? "#6B7280" : "#9CA3AF",
              textAlign: "center",
            }}
          >
            Descon Engineering Manpower Services
          </Text>
        </View>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
