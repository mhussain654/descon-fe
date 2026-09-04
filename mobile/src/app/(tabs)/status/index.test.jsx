import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Linking, RefreshControl } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../../../contexts/AuthContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { applicationProgressClient } from "../../../lib/application-progress-client";
import { candidateWorkflowClient } from "../../../lib/candidate-workflow-client";
import { candidateFlightDetailClient } from "../../../lib/candidate-flight-detail-client";
import { createQueryClientTestLifecycle } from "../../../testSupport/queryClientTestLifecycle";
import StatusScreen from "./index";

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

jest.mock("../../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: jest.fn(), submitDocuments: jest.fn() },
}));
jest.mock("../../../lib/candidate-workflow-client", () => ({
  candidateWorkflowClient: { getWorkflowHistory: jest.fn() },
}));
jest.mock("../../../lib/candidate-flight-detail-client", () => ({
  candidateFlightDetailClient: { getFlightDetail: jest.fn(), requestTicketAccess: jest.fn() },
}));

function flightDetail(overrides = {}) {
  return {
    id: "3fa1d41e-d4aa-4bf3-9838-c0af7080f363",
    airline: "Qatar Airways",
    flightNumber: "QR-123",
    sector: "LHE-DOH",
    flightDepartureAt: "2026-09-20T14:30:00Z",
    ticketAttached: true,
    mobilizedOn: null,
    mobilized: false,
    ...overrides,
  };
}

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

function timelineThrough(currentPosition, { startedAt = "2026-08-01", completedAt = "2026-08-01" } = {}) {
  return CANONICAL_STAGES.map((stage) => {
    if (stage.position < currentPosition) return { ...stage, status: "completed", startedAt: null, completedAt };
    if (stage.position === currentPosition) return { ...stage, status: "current", startedAt, completedAt: null };
    return { ...stage, status: "pending", startedAt: null, completedAt: null };
  });
}

function workflowPayload(overrides = {}) {
  return {
    timeline: timelineThrough(2),
    completedCount: 1,
    totalCount: 15,
    progressPercentage: 6,
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function progressPayload(overrides = {}) {
  return {
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
    workflow: workflowPayload(),
    documents: {
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
    },
    ...overrides,
  };
}

function historyPayload(overrides = {}) {
  return {
    items: [{ fromStage: null, toStage: CANONICAL_STAGES[0], occurredAt: "2026-08-01T00:00:00Z", reasonCode: null, details: null }],
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

// useCandidateFlightDetail unconditionally queries flight-detail state as
// soon as the screen mounts -- default it to "not recorded yet" here so
// the pre-existing tests below (none of which are about the flight ticket)
// don't each need their own mock, mirroring documents/index.test.jsx's
// identical established convention.
beforeEach(() => {
  candidateFlightDetailClient.getFlightDetail.mockResolvedValue(null);
});

afterEach(async () => {
  await cleanup();
  jest.mocked(applicationProgressClient.getProgress).mockReset();
  jest.mocked(candidateWorkflowClient.getWorkflowHistory).mockReset();
  jest.mocked(candidateFlightDetailClient.getFlightDetail).mockReset();
  jest.mocked(candidateFlightDetailClient.requestTicketAccess).mockReset();
  mockReplace.mockReset();
  // One test below persists "ur" via AsyncStorage -- without removing it
  // here, every test running after it in file order would silently render
  // in Urdu instead of the English strings it actually asserts on (same
  // gap documents/index.test.jsx's afterEach was already fixed for).
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await AsyncStorage.removeItem("descon.language");
});

function renderStatusScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <StatusScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

/** The timeline's own row for a stage name -- picks the first match, since the same stage name can legitimately also appear in the "Recent Updates" history section below the timeline. */
function stageRow(labelText) {
  // getByText returns the host Text node; its own `.parent` is Text's
  // composite wrapper, so the JSX content-column View that also holds the
  // sibling "In Progress" badge is one level further up.
  return screen.getAllByText(labelText)[0].parent.parent;
}

describe("StatusScreen", () => {
  it("shows a loading state before progress resolves", async () => {
    applicationProgressClient.getProgress.mockReturnValue(new Promise(() => {}));
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    expect(await screen.findByText("Loading…")).toBeOnTheScreen();
  });

  it("renders the real, backend-authoritative 15-stage workflow timeline exactly as returned, never fabricating or reordering a stage", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    await screen.findByText("Documents Pending");
    for (const stage of CANONICAL_STAGES) {
      expect(screen.getAllByText(stage.name).length).toBeGreaterThan(0);
    }
  });

  it("marks only the timeline's own current stage as in progress, per the backend's status field", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(3) }) }));
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    await screen.findByText("Documents Uploaded");
    expect(within(stageRow("Documents Uploaded")).getByText("In Progress")).toBeOnTheScreen();
    expect(within(stageRow("Verified")).queryByText("In Progress")).toBeNull();
  });

  it("shows the started/completed date the backend reports for each stage", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({
        workflow: workflowPayload({
          timeline: timelineThrough(2, { startedAt: "2026-08-05T00:00:00Z", completedAt: "2026-08-01T00:00:00Z" }),
        }),
      })
    );
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    await screen.findByText("Documents Pending");
    expect(within(stageRow("Registered")).getByText(/Completed 01\/08\/2026/)).toBeOnTheScreen();
    expect(within(stageRow("Documents Pending")).getByText(/Started 05\/08\/2026/)).toBeOnTheScreen();
  });

  it("shows no in-progress stage once fully mobilized, and never fabricates downstream progress", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(16), completedCount: 15, progressPercentage: 100 }) })
    );
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    await screen.findByText("Mobilized");
    expect(screen.queryByText("In Progress")).toBeNull();
  });

  it("shows the QVC outcome on the QVC stage once the backend has recorded one, sourced from workflow history", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(11) }) }));
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(
      historyPayload({
        items: [
          {
            fromStage: CANONICAL_STAGES[8],
            toStage: CANONICAL_STAGES[9],
            occurredAt: "2026-08-09T00:00:00Z",
            reasonCode: null,
            details: { qvcOutcomeCode: "approved", qvcOutcomeDate: "2026-08-09" },
          },
        ],
      })
    );
    renderStatusScreen();

    await screen.findAllByText("QVC Completed / Outcome Received");
    expect(within(stageRow("QVC Completed / Outcome Received")).getByText(/Approved/)).toBeOnTheScreen();
  });

  it("shows the workflow history list", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(
      historyPayload({
        items: [
          { fromStage: null, toStage: CANONICAL_STAGES[0], occurredAt: "2026-08-01T00:00:00Z", reasonCode: null, details: null },
          { fromStage: CANONICAL_STAGES[0], toStage: CANONICAL_STAGES[1], occurredAt: "2026-08-03T00:00:00Z", reasonCode: null, details: null },
        ],
      })
    );
    renderStatusScreen();

    await screen.findByText("Recent Updates");
    expect(screen.getAllByText("Documents Pending").length).toBeGreaterThan(0);
  });

  it("shows an empty state for workflow history when there is none yet", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload({ items: [] }));
    renderStatusScreen();

    expect(await screen.findByText("No updates yet.")).toBeOnTheScreen();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    applicationProgressClient.getProgress.mockRejectedValue({ code: "SESSION_EXPIRED" });
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    expect(await screen.findByText("Session expired")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows a distinct inactive-account state and returns to sign-in on the confirming action", async () => {
    applicationProgressClient.getProgress.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    expect(await screen.findByText("Account inactive")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Return to sign in" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows an offline state with a retry action for a network failure", async () => {
    applicationProgressClient.getProgress.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    expect(await screen.findByText("You are offline")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    await screen.findAllByText("Registered");
  });

  it("retries the query when the retry action is used after a server error", async () => {
    applicationProgressClient.getProgress.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();

    expect(await screen.findByText("Something went wrong.")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    await screen.findAllByText("Registered");
  });

  it("renders the timeline using the server-localized Urdu stage names when that is the persisted language", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({
        workflow: workflowPayload({
          timeline: timelineThrough(2).map((stage) => (stage.code === "registered" ? { ...stage, name: "رجسٹرڈ" } : stage)),
        }),
      })
    );
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("descon.language", "ur");
    renderStatusScreen();

    expect(await screen.findByText("رجسٹرڈ")).toBeOnTheScreen();
  });

  it("refreshes both the workflow timeline and the workflow history on pull-to-refresh, so QVC outcomes and Recent Updates cannot go stale", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    renderStatusScreen();
    await screen.findByText("Documents Pending");
    applicationProgressClient.getProgress.mockClear();
    candidateWorkflowClient.getWorkflowHistory.mockClear();

    screen.UNSAFE_getByType(RefreshControl).props.onRefresh();

    await waitFor(() => expect(applicationProgressClient.getProgress).toHaveBeenCalledTimes(1));
    expect(candidateWorkflowClient.getWorkflowHistory).toHaveBeenCalledTimes(1);
  });

  describe("flight ticket download", () => {
    it("shows no download action when the flight_details_uploaded stage hasn't been reached", async () => {
      applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(3) }) }));
      candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
      candidateFlightDetailClient.getFlightDetail.mockResolvedValue(flightDetail());
      renderStatusScreen();

      await screen.findByText("Flight Details Uploaded");
      expect(within(stageRow("Flight Details Uploaded")).queryByRole("button", { name: "Download Ticket" })).toBeNull();
    });

    it("shows no download action once the stage is reached if no ticket file was actually attached", async () => {
      applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(14) }) }));
      candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
      candidateFlightDetailClient.getFlightDetail.mockResolvedValue(flightDetail({ ticketAttached: false }));
      renderStatusScreen();

      await screen.findByText("Flight Details Uploaded");
      expect(screen.queryByRole("button", { name: "Download Ticket" })).toBeNull();
    });

    it("shows a Download Ticket action once the stage is reached and a ticket is attached", async () => {
      applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(14) }) }));
      candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
      candidateFlightDetailClient.getFlightDetail.mockResolvedValue(flightDetail());
      renderStatusScreen();

      await screen.findByText("Flight Details Uploaded");
      expect(within(stageRow("Flight Details Uploaded")).getByRole("button", { name: "Download Ticket" })).toBeOnTheScreen();
    });

    it("requests a signed URL on press and hands it to the OS via Linking.openURL", async () => {
      applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(14) }) }));
      candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
      candidateFlightDetailClient.getFlightDetail.mockResolvedValue(flightDetail());
      candidateFlightDetailClient.requestTicketAccess.mockResolvedValue({
        flightDetailId: "3fa1d41e-d4aa-4bf3-9838-c0af7080f363",
        url: "/rails/active_storage/blobs/proxy/abc/ticket.pdf",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue();
      renderStatusScreen();

      await screen.findByText("Flight Details Uploaded");
      expect(candidateFlightDetailClient.requestTicketAccess).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.press(within(stageRow("Flight Details Uploaded")).getByRole("button", { name: "Download Ticket" }));
      });

      await waitFor(() => expect(openURL).toHaveBeenCalledTimes(1));
      expect(candidateFlightDetailClient.requestTicketAccess).toHaveBeenCalledWith("candidate-access-token");
      expect(openURL.mock.calls[0][0]).toContain("/rails/active_storage/blobs/proxy/abc/ticket.pdf");
      openURL.mockRestore();
    });

    it("shows a field error when the backend reports the ticket isn't attached after all", async () => {
      applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(14) }) }));
      candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
      candidateFlightDetailClient.getFlightDetail.mockResolvedValue(flightDetail());
      candidateFlightDetailClient.requestTicketAccess.mockRejectedValue({
        code: "TICKET_NOT_ATTACHED",
        message: "Your flight ticket has not been uploaded yet.",
      });
      renderStatusScreen();

      await screen.findByText("Flight Details Uploaded");
      await act(async () => {
        fireEvent.press(within(stageRow("Flight Details Uploaded")).getByRole("button", { name: "Download Ticket" }));
      });

      expect(await screen.findByText("Your flight ticket has not been uploaded yet.")).toBeOnTheScreen();
    });
  });
});
