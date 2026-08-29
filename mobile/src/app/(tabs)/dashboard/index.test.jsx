import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../../../contexts/AuthContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { candidateProfileClient } from "../../../lib/candidate-profile-client";
import { candidateDocumentsClient } from "../../../lib/candidate-documents-client";
import { applicationProgressClient } from "../../../lib/application-progress-client";
import { createQueryClientTestLifecycle } from "../../../testSupport/queryClientTestLifecycle";
import DashboardScreen from "./index";

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

jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: () => [true],
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
}));

jest.mock("../../../lib/candidate-profile-client", () => ({
  candidateProfileClient: { getProfile: jest.fn() },
}));
jest.mock("../../../lib/candidate-documents-client", () => ({
  candidateDocumentsClient: { getChecklist: jest.fn(), uploadDocument: jest.fn() },
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

function documentsSummary(overrides = {}) {
  return {
    requiredTotal: 2,
    missing: 1,
    uploaded: 1,
    pendingReview: 0,
    verified: 0,
    rejected: 0,
    submittedTotal: 1,
    completionPercentage: 50,
    canSubmit: false,
    submissionState: "incomplete",
    blockingRequirements: [],
    ...overrides,
  };
}

function progress(overrides = {}) {
  return {
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
    documents: documentsSummary(),
    ...overrides,
  };
}

function checklistItem(overrides = {}) {
  return {
    requirementCode: "passport",
    name: "Passport",
    required: true,
    status: "missing",
    replacementAllowed: true,
    document: null,
    ...overrides,
  };
}

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

afterEach(async () => {
  await cleanup();
  jest.mocked(candidateProfileClient.getProfile).mockReset();
  jest.mocked(candidateDocumentsClient.getChecklist).mockReset();
  jest.mocked(applicationProgressClient.getProgress).mockReset();
  mockReplace.mockReset();
});

function renderDashboardScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <DashboardScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

describe("DashboardScreen", () => {
  it("shows the candidate's real name, reference number, workflow stage and completion percentage", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem()]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText("Ahmed Ali")).toBeOnTheScreen();
    expect(screen.getByText("DES-001001")).toBeOnTheScreen();
    expect(screen.getByText("Documents Uploaded (In Progress)")).toBeOnTheScreen();
    expect(screen.getByText("50% complete")).toBeOnTheScreen();
  });

  it("shows the verified chip only once the backend reports the submission as verified", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState: "verified", completionPercentage: 100 }) })
    );
    renderDashboardScreen();

    expect(await screen.findByText("100% complete")).toBeOnTheScreen();
    // "Verified" now legitimately appears twice once fully verified -- the
    // green chip, and the current-status line's stage name (no longer
    // ambiguous with the in-progress case, which appends "(In Progress)").
    expect(screen.getAllByText("Verified")).toHaveLength(2);
  });

  it("does not show the verified chip while documents are only partially verified", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState: "partially_verified" }) })
    );
    renderDashboardScreen();

    await screen.findByText("Ahmed Ali");
    expect(screen.queryByText("Verified")).toBeNull();
  });

  it("prompts to upload the missing required document as the highest-priority next step", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText(/Upload your missing document: Passport/)).toBeOnTheScreen();
  });

  it("prompts to replace a rejected, replaceable required document ahead of a missing one", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      checklistItem({ requirementCode: "passport", status: "rejected", replacementAllowed: true }),
      checklistItem({ requirementCode: "cnic_front", name: "CNIC", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText(/Replace your rejected document: Passport/)).toBeOnTheScreen();
  });

  it("shows the waiting-for-verification fallback once fully verified with nothing left to do", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "verified" })]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState: "verified", missing: 0, verified: 1 }) })
    );
    renderDashboardScreen();

    expect(await screen.findByText("Verification complete")).toBeOnTheScreen();
  });

  it("navigates to the documents and status screens from the quick-action tiles", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    await screen.findByText("Ahmed Ali");
    expect(screen.getByText("Upload Documents")).toBeOnTheScreen();
    expect(screen.getByText("View Status")).toBeOnTheScreen();
    expect(screen.getByText("Make Payment")).toBeOnTheScreen();
  });

  it("ends the session and returns to sign-in on a session-expired error from any source query", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SESSION_EXPIRED" });
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("renders the dashboard in Urdu when that is the persisted language", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("descon.language", "ur");
    renderDashboardScreen();

    expect(await screen.findByText("خوش آمدید")).toBeOnTheScreen();
  });
});
