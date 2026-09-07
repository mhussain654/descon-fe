import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { candidateConsentClient } from "../lib/candidate-consent-client";
import { createQueryClientTestLifecycle } from "../testSupport/queryClientTestLifecycle";
import ConsentScreen from "./consent";

const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: (...args) => mockReplace(...args) }),
  Redirect: ({ href }) => {
    const { Text } = require("react-native");
    return <Text>redirect:{href}</Text>;
  },
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: () => [true],
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
}));

jest.mock("../lib/candidate-consent-client", () => ({
  candidateConsentClient: { fetchStatus: jest.fn(), accept: jest.fn() },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() =>
    Promise.resolve(
      JSON.stringify({
        accessToken: "candidate-access-token",
        refreshToken: "refresh",
        candidateId: "candidate-public-id-1",
        candidateName: "Ahmed Ali",
        preferredLocale: "en",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        consent: { currentPolicyVersion: "2026-09-06", accepted: false, acceptedAt: null },
      })
    )
  ),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

afterEach(async () => {
  await cleanup();
  jest.mocked(candidateConsentClient.accept).mockReset();
  mockReplace.mockReset();
});

function renderConsentScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <ConsentScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

describe("ConsentScreen", () => {
  it("shows the consent message and an Accept action for a candidate who hasn't accepted", async () => {
    renderConsentScreen();

    expect(await screen.findByText("I Agree & Continue")).toBeOnTheScreen();
  });

  it("records acceptance and navigates to the dashboard on success", async () => {
    candidateConsentClient.accept.mockResolvedValue({
      currentPolicyVersion: "2026-09-06",
      accepted: true,
      acceptedAt: "2026-09-06T12:00:00Z",
    });
    renderConsentScreen();

    fireEvent.press(await screen.findByText("I Agree & Continue"));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard"));
    expect(candidateConsentClient.accept).toHaveBeenCalledWith("candidate-access-token");
  });

  it("shows an error message and stays on the consent screen when acceptance fails", async () => {
    candidateConsentClient.accept.mockRejectedValue({ code: "SERVER_ERROR" });
    renderConsentScreen();

    fireEvent.press(await screen.findByText("I Agree & Continue"));

    expect(await screen.findByText("We could not record your consent. Please try again.")).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("logs the candidate out when they decline", async () => {
    renderConsentScreen();

    fireEvent.press(await screen.findByText("Logout"));

    await waitFor(() =>
      expect(jest.requireMock("expo-secure-store").deleteItemAsync).toHaveBeenCalledWith("descon.candidateSession")
    );
  });
});
