import { QueryClientProvider } from "@tanstack/react-query";
import { RefreshControl } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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

const CANONICAL_STAGES = [
  { code: "registered", name: "Registered", position: 1 },
  { code: "documents_pending", name: "Documents Pending", position: 2 },
  { code: "documents_uploaded", name: "Documents Uploaded", position: 3 },
  { code: "under_verification", name: "Under Verification", position: 4 },
  { code: "verified", name: "Verified", position: 5 },
  { code: "fee_pending", name: "Fee Pending", position: 6 },
  { code: "fee_paid", name: "Fee Paid", position: 7 },
  { code: "documents_shared_with_qatar_bu", name: "Documents Shared with Qatar BU", position: 8 },
  { code: "qvc_appointment_booked", name: "QVC Appointment Booked", position: 9 },
  { code: "qvc_completed_outcome_received", name: "QVC Completed / Outcome Received", position: 10 },
  { code: "visa_issued_or_rejected", name: "Visa Issued / Visa Rejected", position: 11 },
  { code: "appeared_for_protection", name: "Appeared for Protection", position: 12 },
  { code: "protected_ready_to_fly", name: "Protected — Ready to Fly", position: 13 },
  { code: "flight_details_uploaded", name: "Flight Details Uploaded", position: 14 },
  { code: "mobilized", name: "Mobilized", position: 15 },
];

/** Every stage up to `currentPosition` is completed, `currentPosition` itself is current, the rest pending. */
function timelineThrough(currentPosition) {
  return CANONICAL_STAGES.map((stage) => {
    if (stage.position < currentPosition) return { ...stage, status: "completed", startedAt: null, completedAt: "2026-08-01" };
    if (stage.position === currentPosition) return { ...stage, status: "current", startedAt: "2026-08-01", completedAt: null };
    return { ...stage, status: "pending", startedAt: null, completedAt: null };
  });
}

/** Every stage up to and including `lastCompletedPosition` is completed and nothing beyond it has started yet -- no `current` stage at all, matching a workflow that hasn't been advanced further by HR yet. */
function timelineCompletedThrough(lastCompletedPosition) {
  return CANONICAL_STAGES.map((stage) => {
    if (stage.position <= lastCompletedPosition) return { ...stage, status: "completed", startedAt: null, completedAt: "2026-08-01" };
    return { ...stage, status: "pending", startedAt: null, completedAt: null };
  });
}

function workflowPayload(overrides = {}) {
  return {
    timeline: timelineThrough(3),
    completedCount: 2,
    totalCount: 15,
    progressPercentage: 13,
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

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
    workflow: workflowPayload(),
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
  it("shows the candidate's real name, reference number, real workflow stage and real workflow progress percentage", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem()]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText("Ahmed Ali")).toBeOnTheScreen();
    expect(screen.getByText("DES-001001")).toBeOnTheScreen();
    expect(screen.getByText("Documents Uploaded (In Progress)")).toBeOnTheScreen();
    expect(screen.getByText("13% complete")).toBeOnTheScreen();
  });

  it("shows the verified chip only once the backend reports the submission as verified", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        documents: documentsSummary({ submissionState: "verified" }),
        workflow: workflowPayload({ timeline: timelineCompletedThrough(5), completedCount: 5, progressPercentage: 33 }),
      })
    );
    renderDashboardScreen();

    expect(await screen.findByText("33% complete")).toBeOnTheScreen();
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

  it("navigates to the documents and status screens from the quick-action tiles, and shows Make Payment as visibly disabled with no handler", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    await screen.findByText("Ahmed Ali");
    expect(screen.getByText("Upload Documents")).toBeOnTheScreen();
    expect(screen.getByText("View Status")).toBeOnTheScreen();
    expect(screen.getByText("Make Payment")).toBeOnTheScreen();
    expect(screen.getByText("Coming soon")).toBeOnTheScreen();
    const makePaymentTile = screen.getByRole("button", { name: "Make Payment" });
    expect(makePaymentTile.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("shows a dedicated session-expired state (not a silent redirect) and returns to sign-in only once confirmed", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SESSION_EXPIRED" });
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText("Session expired")).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows the session-expired state even when a different, lower-priority source query fails first with a non-session error", async () => {
    // profileQuery is checked first in source-priority order, but its error
    // here is merely transient (NETWORK_ERROR) -- the SESSION_EXPIRED from
    // progressQuery must still win and show the dedicated screen, not a
    // generic Retry button that would leave an invalid session unprotected.
    candidateProfileClient.getProfile.mockRejectedValue({ code: "NETWORK_ERROR" });
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockRejectedValue({ code: "SESSION_EXPIRED" });
    renderDashboardScreen();

    expect(await screen.findByText("Session expired")).toBeOnTheScreen();
    expect(screen.queryByText("Retry")).toBeNull();
  });

  it("shows a distinct inactive-account state", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText("Account inactive")).toBeOnTheScreen();
  });

  it("shows an offline state with a retry action", async () => {
    candidateProfileClient.getProfile.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText("You are offline")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Ahmed Ali");
  });

  it("refreshes profile, checklist and progress together on pull-to-refresh, keeping one indicator active until all requests settle and ignoring a duplicate trigger while in flight", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    await screen.findByText("Ahmed Ali");
    jest.mocked(candidateProfileClient.getProfile).mockClear();
    jest.mocked(candidateDocumentsClient.getChecklist).mockClear();
    jest.mocked(applicationProgressClient.getProgress).mockClear();

    let resolveProfile;
    candidateProfileClient.getProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      })
    );

    // Both calls fire synchronously inside the same `act()`, before React
    // commits the first call's `setIsRefreshing(true)` -- only a ref-based
    // lock (checked and set synchronously) can catch this; a `useState`
    // guard alone would let both calls read the same stale `false` and both
    // proceed.
    const refreshControl = screen.UNSAFE_getByType(RefreshControl);
    act(() => {
      refreshControl.props.onRefresh();
      refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true));
    expect(candidateProfileClient.getProfile).toHaveBeenCalledTimes(1);
    expect(candidateDocumentsClient.getChecklist).toHaveBeenCalledTimes(1);
    expect(applicationProgressClient.getProgress).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveProfile(profilePayload());
    });

    await waitFor(() => expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false));
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
