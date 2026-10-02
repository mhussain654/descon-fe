import { QueryClientProvider } from "@tanstack/react-query";
import { Linking, RefreshControl } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../../../contexts/AuthContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { candidateProfileClient } from "../../../lib/candidate-profile-client";
import { candidateDocumentsClient } from "../../../lib/candidate-documents-client";
import { applicationProgressClient } from "../../../lib/application-progress-client";
import { trainingSettingClient } from "../../../lib/training-setting-client";
import { supportSettingClient } from "../../../lib/support-setting-client";
import { candidateWorkflowClient } from "../../../lib/candidate-workflow-client";
import { createQueryClientTestLifecycle } from "../../../testSupport/queryClientTestLifecycle";
import { toast } from "../../../design-system";
import DashboardScreen from "./index";

const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: (...args) => mockReplace(...args), push: (...args) => mockPush(...args), back: jest.fn() }),
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
jest.mock("../../../lib/training-setting-client", () => ({
  trainingSettingClient: { getTrainingSetting: jest.fn() },
}));
jest.mock("../../../lib/support-setting-client", () => ({
  supportSettingClient: { getSupportSetting: jest.fn() },
}));
jest.mock("../../../lib/candidate-workflow-client", () => ({
  candidateWorkflowClient: { getWorkflowHistory: jest.fn() },
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

// Every test renders the screen, and useTrainingSetting unconditionally
// queries the training-link setting as soon as it mounts -- default it to a
// resolved link here so the pre-existing tests below (none of which are
// about the Training quick action) don't each need their own mock, mirroring
// candidateFlightDetailClient.getFlightDetail's identical established
// convention in this same describe block's sibling screens.
beforeEach(() => {
  trainingSettingClient.getTrainingSetting.mockResolvedValue({ url: "https://www.youtube.com/@DesconManpower" });
  supportSettingClient.getSupportSetting.mockResolvedValue({ phoneNumber: "+923001234567" });
  candidateWorkflowClient.getWorkflowHistory.mockResolvedValue({ items: [], updatedAt: null });
});

afterEach(async () => {
  await cleanup();
  jest.mocked(candidateProfileClient.getProfile).mockReset();
  jest.mocked(candidateDocumentsClient.getChecklist).mockReset();
  jest.mocked(applicationProgressClient.getProgress).mockReset();
  jest.mocked(trainingSettingClient.getTrainingSetting).mockReset();
  jest.mocked(supportSettingClient.getSupportSetting).mockReset();
  jest.mocked(candidateWorkflowClient.getWorkflowHistory).mockReset();
  mockReplace.mockReset();
  mockPush.mockReset();
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
    expect(screen.getByText("Reference: DES-001001")).toBeOnTheScreen();
    // The current stage is the highlighted status badge on "My Journey".
    expect(screen.getByText("Documents Uploaded")).toBeOnTheScreen();
    expect(screen.getByText("2 of 15 steps completed")).toBeOnTheScreen();
    expect(screen.getByText("13% complete")).toBeOnTheScreen();
  });

  it("shows the Business Unit country and falls back to initials when there is no photo", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ country: { code: "qatar", name: "Qatar" }, photoUrl: null }));
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText("Qatar")).toBeOnTheScreen();
    expect(screen.getByText("AA")).toBeOnTheScreen();
    expect(screen.getByLabelText("Profile photo")).toBeOnTheScreen();
  });

  it("counts completed steps out of the full workflow", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        documents: documentsSummary({ submissionState: "verified" }),
        workflow: workflowPayload({ timeline: timelineCompletedThrough(5), completedCount: 5, progressPercentage: 33 }),
      })
    );
    renderDashboardScreen();

    expect(await screen.findByText("5 of 15 steps completed")).toBeOnTheScreen();
    expect(screen.getByText("33% complete")).toBeOnTheScreen();
  });

  it("prompts to upload required documents generically when nothing has been submitted yet", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText(/Upload your required documents/)).toBeOnTheScreen();
    expect(screen.queryByText(/Passport/)).toBeNull();
  });

  it("prompts to upload the specific missing required document once some documents are already submitted", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      checklistItem({ status: "uploaded" }),
      checklistItem({ requirementCode: "cnic", name: "CNIC", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    expect(await screen.findByText(/Upload your missing document: CNIC/)).toBeOnTheScreen();
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

  it("announces the upcoming stage -- not the current one -- once the next move is on staff's side", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "verified" })]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        currentWorkflowStage: { code: "fee_paid", name: "Fee Paid" },
        documents: documentsSummary({ submissionState: "verified", missing: 0, verified: 1 }),
        workflow: workflowPayload({ timeline: timelineThrough(7), completedCount: 6, progressPercentage: 40 }),
      })
    );
    renderDashboardScreen();

    expect(await screen.findByText("Next step")).toBeOnTheScreen();
    expect(screen.getByText("Documents Shared with Qatar BU")).toBeOnTheScreen();
    // "Fee Paid" is the current-stage badge only, never repeated as the next step.
    expect(screen.getAllByText("Fee Paid")).toHaveLength(1);
    expect(screen.queryByText(/Continue with your application/)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "View status" }));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/status");
  });

  it("congratulates the candidate once every stage is complete", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "verified" })]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        currentWorkflowStage: { code: "mobilized", name: "Mobilized" },
        documents: documentsSummary({ submissionState: "verified", missing: 0, verified: 1 }),
        workflow: workflowPayload({ timeline: timelineCompletedThrough(15), completedCount: 15, progressPercentage: 100 }),
      })
    );
    renderDashboardScreen();

    expect(await screen.findByText("All steps completed")).toBeOnTheScreen();
  });

  // Regression: documents.submissionState stays "verified" forever once
  // verification happens, even long after the candidate moved on to a later
  // stage. Without gating on the *current* workflow stage too, this kept
  // announcing "Verification complete" as the next action while the
  // candidate's real next step (paying the fee) went unmentioned.
  it("does not re-announce verification once the candidate has moved past the verified stage", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "verified" })]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        currentWorkflowStage: { code: "fee_pending", name: "Fee Pending" },
        documents: documentsSummary({ submissionState: "verified", missing: 0, verified: 1 }),
      })
    );
    renderDashboardScreen();

    expect(await screen.findByText("Pay onboarding fee")).toBeOnTheScreen();
    expect(screen.queryByText("Verification complete")).toBeNull();
  });

  it("shows the configured onboarding fee and goes to payment from Pay now", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(
      profilePayload({ payment: { amount: "10500.00", currencyCode: "PKR" } })
    );
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "verified" })]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        currentWorkflowStage: { code: "fee_pending", name: "Fee Pending" },
        documents: documentsSummary({ submissionState: "verified", missing: 0, verified: 1 }),
      })
    );
    renderDashboardScreen();

    expect(await screen.findByText(/10,500/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Pay now" }));
    expect(mockPush).toHaveBeenCalledWith("/payment");
  });

  it("sends a documents problem to Documents from the next-step card", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Go to documents" }));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/documents");
  });

  it("navigates to Documents and Application Status from the quick-action tiles", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDashboardScreen();

    await screen.findByText("Ahmed Ali");
    fireEvent.press(screen.getByRole("button", { name: /^Documents,/ }));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/documents");
    fireEvent.press(screen.getByRole("button", { name: /^Application Status,/ }));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/status");
  });

  describe("Help & Support quick action", () => {
    it("dials the admin-configured support number", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
      candidateDocumentsClient.getChecklist.mockResolvedValue([]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue();
      renderDashboardScreen();

      await screen.findByText("Ahmed Ali");
      const supportTile = await screen.findByRole("button", { name: /^Help & Support,/ });
      await waitFor(() => expect(supportTile.props.accessibilityState).toMatchObject({ disabled: false }));

      fireEvent.press(supportTile);
      expect(openURL).toHaveBeenCalledWith("tel:+923001234567");
      openURL.mockRestore();
    });

    it("stays fully usable before a number is configured, explaining instead of dialing", async () => {
      supportSettingClient.getSupportSetting.mockResolvedValue({ phoneNumber: null });
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
      candidateDocumentsClient.getChecklist.mockResolvedValue([]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue();
      const info = jest.spyOn(toast, "info").mockImplementation(() => "toast-id");
      renderDashboardScreen();

      await screen.findByText("Ahmed Ali");
      const supportTile = screen.getByRole("button", { name: /^Help & Support,/ });
      expect(supportTile.props.accessibilityState).toMatchObject({ disabled: false });

      fireEvent.press(supportTile);
      expect(openURL).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith("Our support line isn’t available yet. Please try again later.");
      openURL.mockRestore();
      info.mockRestore();
    });
  });

  describe("Latest update", () => {
    it("shows the most recent completed step with its explanation, and links to the full history", async () => {
      candidateWorkflowClient.getWorkflowHistory.mockResolvedValue({
        items: [
          { fromStage: null, toStage: { code: "documents_uploaded", name: "Documents Uploaded", position: 3 }, occurredAt: "2026-09-01T10:00:00Z", reasonCode: null, details: null },
          { fromStage: null, toStage: { code: "verified", name: "Verified", position: 5 }, occurredAt: "2026-09-05T10:00:00Z", reasonCode: null, details: null },
        ],
        updatedAt: "2026-09-05T10:00:00Z",
      });
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
      candidateDocumentsClient.getChecklist.mockResolvedValue([]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      renderDashboardScreen();

      expect(await screen.findByText("Your required documents have been approved.")).toBeOnTheScreen();
      fireEvent.press(screen.getByRole("link", { name: "See all" }));
      expect(mockPush).toHaveBeenCalledWith("/(tabs)/status");
    });

    it("shows a friendly empty message before any step has completed", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
      candidateDocumentsClient.getChecklist.mockResolvedValue([]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      renderDashboardScreen();

      expect(await screen.findByText(/No updates yet/)).toBeOnTheScreen();
    });
  });

  describe("Training quick action", () => {
    it("opens the admin-managed training link directly via the OS, once loaded -- no intermediate screen", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
      candidateDocumentsClient.getChecklist.mockResolvedValue([]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      trainingSettingClient.getTrainingSetting.mockResolvedValue({ url: "https://www.youtube.com/@DesconManpower" });
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue();
      renderDashboardScreen();

      await screen.findByText("Ahmed Ali");
      const trainingTile = await screen.findByRole("button", { name: /^Training,/ });
      expect(trainingTile.props.accessibilityState).toMatchObject({ disabled: false });

      fireEvent.press(trainingTile);
      expect(openURL).toHaveBeenCalledWith("https://www.youtube.com/@DesconManpower");
      openURL.mockRestore();
    });

    it("stays disabled (never opens a stale/empty link) while the training link is still loading", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
      candidateDocumentsClient.getChecklist.mockResolvedValue([]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      trainingSettingClient.getTrainingSetting.mockReturnValue(new Promise(() => {}));
      renderDashboardScreen();

      await screen.findByText("Ahmed Ali");
      expect(screen.getByRole("button", { name: /^Training,/ }).props.accessibilityState).toMatchObject({ disabled: true });
    });

    it("stays disabled if the training link fails to load, rather than opening a broken link", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
      candidateDocumentsClient.getChecklist.mockResolvedValue([]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      trainingSettingClient.getTrainingSetting.mockRejectedValue({ code: "SERVER_ERROR" });
      renderDashboardScreen();

      await screen.findByText("Ahmed Ali");
      expect(await screen.findByRole("button", { name: /^Training,/ })).toHaveProperty(
        "props.accessibilityState.disabled",
        true
      );
    });
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

    expect(await screen.findByText("میرا سفر")).toBeOnTheScreen();
  });
});
