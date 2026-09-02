import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { AuthProvider } from "../contexts/AuthContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { Toaster } from "../design-system/toast";
SplashScreen.preventAutoHideAsync();

// The standard TanStack Query React Native recipe: without this, the
// library has no way to know the app backgrounded/foregrounded at all, so
// `refetchOnWindowFocus`/`refetchIntervalInBackground: false` (used by the
// candidate document/progress queries for live sync -- see
// shared/queryKeys/documentQueries.ts's consumers) are silent no-ops on
// native. Wired once, here, for the whole app rather than per-screen.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (state) => {
    handleFocus(state === "active");
  });
  return () => subscription.remove();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error) => {
        const apiError = error;
        if (apiError?.code === "NETWORK_ERROR" || apiError?.code === "TIMEOUT") {
          return failureCount < 2;
        }
        if (typeof apiError?.status === "number" && apiError.status >= 500) {
          return failureCount < 1;
        }
        return false;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack
              screenOptions={{ headerShown: false }}
              initialRouteName="index"
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="payment" />
              {/* Developer-facing component reference, not a candidate screen --
                  excluded from production builds (redirects to the initial
                  route if somehow navigated to), matching the equivalent web
                  exclusion in web/src/app/routes.ts. */}
              <Stack.Screen name="design-system" redirect={!__DEV__} />
            </Stack>
            <Toaster />
          </GestureHandlerRootView>
        </AuthProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}
