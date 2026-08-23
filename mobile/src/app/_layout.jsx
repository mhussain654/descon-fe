import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "../contexts/LanguageContext";
import { Toaster } from "../design-system/toast";
SplashScreen.preventAutoHideAsync();

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
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack
            screenOptions={{ headerShown: false }}
            initialRouteName="index"
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            {/* Developer-facing component reference, not a candidate screen --
                excluded from production builds (redirects to the initial
                route if somehow navigated to), matching the equivalent web
                exclusion in web/src/app/routes.ts. */}
            <Stack.Screen name="design-system" redirect={!__DEV__} />
          </Stack>
          <Toaster />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </LanguageProvider>
  );
}
