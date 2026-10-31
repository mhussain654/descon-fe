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
        consent: { currentPolicyVersion: "v1", accepted: true, acceptedAt: "2026-09-06T12:00:00Z" },
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
    country: { code: "qatar", name: "Qatar" },
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

// Climbs to the n-th enclosing host View, ignoring wrapper components (e.g. the shared Text), so the
// test does not depend on how many component layers sit between a label and its row.
function hostViewAncestor(node, levels) {
  let current = node;
  for (let found = 0; found < levels; ) {
    current = current.parent;
    if (current.type === "View") found += 1;
  }
  return current;
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
    expect(screen.getAllByText("DES-001001")).toHaveLength(1);
    expect(screen.getByText("Assignment & progress")).toBeOnTheScreen();
    expect(screen.getByText("Preferences & account")).toBeOnTheScreen();
    expect(screen.getByText("File No.")).toBeOnTheScreen();
    // Only the current status: no separate current-stage or document-verification rows.
    expect(screen.queryByText("Current stage")).toBeNull();
    expect(screen.queryByText("Document verification")).toBeNull();

    expect(screen.queryByText("42101-1234567-1")).toBeNull();
  });

  it("uses the candidate photo in the header", async () => {
    const originalApiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://example.com/api/v1";
    const photoUrl = "https://example.com/profile.jpg";
    try {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ photoUrl }));
      renderProfileScreen();
      await screen.findByText("Ahmed Ali");
      expect(screen.getByTestId("profile-header-photo", { includeHiddenElements: true })).toHaveProp("source", [{ uri: photoUrl }]);
    } finally {
      if (originalApiBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
      else process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBase;
    }
  });

  it("shows the name initial in the header when no photo is uploaded", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ photoUrl: null }));
    renderProfileScreen();
    await screen.findByText("Ahmed Ali");
    expect(screen.queryByTestId("profile-header-photo", { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByText("A", { includeHiddenElements: true })).toHaveLength(2);
  });

  it("shows the current status as the mobilization step and its status, e.g. Visa approved", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({
        workflow: {
          mobilizationProcess: { code: "qatar_mobilization", version: 1, provisional: false, countryCode: "qatar" },
          outcomes: { medical: "fit", visa: null },
          timeline: ["registered", "documents_pending", "verified", "fee_paid", "qvc_completed_outcome_received", "visa_issued_or_rejected", "mobilized"].map(
            (code, index) => ({
              code,
              name: code,
              position: index + 1,
              actionType: "none",
              required: true,
              status: index < 5 ? "completed" : index === 5 ? "current" : "pending",
              startedAt: index === 5 ? "2026-10-01T00:00:00Z" : null,
              completedAt: index < 5 ? "2026-09-01T00:00:00Z" : null,
            })
          ),
          completedCount: 5,
          totalCount: 7,
          progressPercentage: 71,
          updatedAt: "2026-10-01T00:00:00Z",
        },
      })
    );
    renderProfileScreen();

    const row = hostViewAncestor(await screen.findByText("Current status"), 2);
    expect(within(row).getByText("Visa approved")).toBeOnTheScreen();
  });

  it("falls back to the candidate status until progress has loaded", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    applicationProgressClient.getProgress.mockReturnValue(new Promise(() => {}));
    renderProfileScreen();

    const row = hostViewAncestor(await screen.findByText("Current status"), 2);
    expect(within(row).getByText("Documents pending")).toBeOnTheScreen();
  });

  it("asks for a clear photo of the candidate's own face, and opens the photo full size when tapped", async () => {
    const originalApiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://example.com/api/v1";
    try {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ photoUrl: "https://example.com/profile.jpg" }));
      renderProfileScreen();

      expect(await screen.findByText("Upload a clear photo of your own face. Other pictures are not allowed.")).toBeOnTheScreen();
      fireEvent.press(screen.getByRole("button", { name: "View photo full size" }));
      fireEvent.press(await screen.findByRole("button", { name: "Close photo" }));
    } finally {
      if (originalApiBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
      else process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBase;
    }
  });

  it("shows which country the application is in process for", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    expect(await screen.findByText("In process for")).toBeOnTheScreen();
    expect(screen.getByText("Qatar")).toBeOnTheScreen();
  });

  it("shows the empty-assignment label for the destination when there is no assignment yet", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ country: null }));
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
