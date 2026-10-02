import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { House, Files, ClipboardList, UserRound } from "lucide-react-native";
import { RequireAuth } from "../../features/auth/RequireAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { getFontFamily } from "../../design-system";

// Every candidate tab renders through this layout, so guarding here protects
// dashboard/documents/status/profile in one place (AGENTS.md / MPS-F201:
// "Protected routes/tabs must never render before authorization is
// confirmed").
export default function TabLayout() {
  return (
    <RequireAuth>
      <TabNavigator />
    </RequireAuth>
  );
}

function TabNavigator() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const isUrdu = language === "ur";
  // Nastaliq labels need far more line height than Inter, so the bar's own
  // height grows with them (plus the home-indicator inset) rather than
  // clipping the label.
  const barContentHeight = isUrdu ? 70 : 60;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Rounded, softly-shadowed bar from the approved home design: it
        // reads as a floating panel without actually overlapping content.
        tabBarStyle: {
          backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
          borderTopWidth: 0,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingTop: 6,
          height: barContentHeight + insets.bottom,
          paddingBottom: insets.bottom + 4,
          shadowColor: "#1A4178",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarActiveTintColor: "#0871DF",
        tabBarInactiveTintColor: isDark ? "#9CA3AF" : "#768198",
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: isUrdu ? 22 : 14,
          fontWeight: "600",
          fontFamily: getFontFamily(language, "semibold"),
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabHome"),
          tabBarIcon: ({ color }) => <House color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: t("documents"),
          tabBarIcon: ({ color }) => <Files color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: t("tabMyJourney"),
          tabBarIcon: ({ color }) => <ClipboardList color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarIcon: ({ color }) => <UserRound color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
