import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../../../contexts/AuthContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { candidateProfileClient } from "../../../lib/candidate-profile-client";
import { applicationProgressClient } from "../../../lib/application-progress-client";
import { createQueryClientTestLifecycle } from "../../../testSupport/queryClientTestLifecycle";
import ProfileScreen from "./index";

const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: (...args) => mockReplace(...args), push: jest.fn(), back: jest.fn() }),
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
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    )
  ),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));

jest.mock("../../../lib/candidate-profile-client", () => ({
  candidateProfileClient: { getProfile: jest.fn() },
}));
jest.mock("../../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: jest.fn(), submitDocuments: jest.fn() },
}));

function profilePayload(overrides = {}) {
  return {
    id: "candidate-public-id-1",
    fullName: "Ahmed Ali",
    maskedCnic: "42101-*******-1",
    referenceNumber: "DES-001001",
    preferredLocale: "en",
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
    active: true,
    ...overrides,
  };
}

function progressPayload(overrides = {}) {
  return {
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
    documents: {
      requiredTotal: 3,
      missing: 0,
      uploaded: 0,
      pendingReview: 0,
      verified: 3,
      rejected: 0,
      submittedTotal: 3,
      completionPercentage: 100,
      canSubmit: false,
      submissionState: "verified",
      blockingRequirements: [],
    },
    ...overrides,
  };
}

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

afterEach(async () => {
  await cleanup();
  jest.mocked(candidateProfileClient.getProfile).mockReset();
  jest.mocked(applicationProgressClient.getProgress).mockReset();
  mockReplace.mockReset();
  // Otherwise a test that toggles to Urdu (AsyncStorage) leaks into
  // whichever test runs next, since LanguageProvider reads it back on mount.
  await AsyncStorage.clear();
});

function renderProfileScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <ProfileScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
  });

  it("shows a loading state before the profile resolves", async () => {
    candidateProfileClient.getProfile.mockReturnValue(new Promise(() => {}));
    renderProfileScreen();

    expect(await screen.findByText("Loading…")).toBeOnTheScreen();
  });

  it("renders only the approved safe fields once loaded, never the raw CNIC", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    expect(await screen.findByText("Ahmed Ali")).toBeOnTheScreen();
    expect(screen.getByText("42101-*******-1")).toBeOnTheScreen();
    expect(screen.getAllByText("DES-001001").length).toBeGreaterThan(0);
    expect(screen.getByText("Documents pending")).toBeOnTheScreen();

    expect(screen.queryByText("42101-1234567-1")).toBeNull();
  });

  it("shows the document-verification row reflecting the backend's submissionState", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ documents: { ...progressPayload().documents, submissionState: "verified" } }));
    renderProfileScreen();

    const section = (await screen.findByText("Document verification")).parent.parent;
    expect(within(section).getByText("Verified")).toBeOnTheScreen();
  });

  it("shows the partially-verified label while documents are only partially verified", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({
        documents: {
          ...progressPayload().documents,
          verified: 1,
          pendingReview: 2,
          submittedTotal: 3,
          submissionState: "partially_verified",
        },
      })
    );
    renderProfileScreen();

    const section = (await screen.findByText("Document verification")).parent.parent;
    expect(within(section).getByText("Partially verified")).toBeOnTheScreen();
  });

  it("does not render the document-verification row until progress has loaded", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    applicationProgressClient.getProgress.mockReturnValue(new Promise(() => {}));
    renderProfileScreen();

    await screen.findByText("Ahmed Ali");
    expect(screen.queryByText("Document verification")).toBeNull();
  });

  it("shows the empty-assignment label when there is no current workflow stage", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ currentWorkflowStage: null }));
    renderProfileScreen();

    expect(await screen.findByText("Not assigned yet")).toBeOnTheScreen();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SESSION_EXPIRED" });
    renderProfileScreen();

    expect(await screen.findByText("Session expired")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows a distinct inactive-account state, not the generic session-expired one", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    renderProfileScreen();

    expect(await screen.findByText("Account inactive")).toBeOnTheScreen();
    expect(screen.queryByText("Session expired")).toBeNull();
  });

  it("shows an offline state with a retry action for a network failure", async () => {
    candidateProfileClient.getProfile.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(profilePayload());
    renderProfileScreen();

    expect(await screen.findByText("You are offline")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Ahmed Ali");
  });

  it("always keeps logout reachable, even while the profile fails to load", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SERVER_ERROR" });
    renderProfileScreen();

    expect(await screen.findByRole("button", { name: "Logout" })).toBeOnTheScreen();
  });

  it("toggles to Urdu when the language row is pressed", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    await screen.findByText("Ahmed Ali");
    fireEvent.press(screen.getByRole("button", { name: "Language" }));

    expect(await screen.findByText("شناختی کارڈ")).toBeOnTheScreen();
  });

  it("ends the session and returns to sign-in when logout is pressed", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    await screen.findByText("Ahmed Ali");
    fireEvent.press(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });
});
