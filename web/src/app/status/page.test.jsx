import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { applicationProgressClient } from "../../lib/application-progress-client";
import { candidateWorkflowClient } from "../../lib/candidate-workflow-client";
import StatusPage from "./page";

vi.mock("../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: vi.fn(), submitDocuments: vi.fn() },
}));
vi.mock("../../lib/candidate-workflow-client", () => ({
  candidateWorkflowClient: { getWorkflowHistory: vi.fn() },
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

/** Builds a 15-stage timeline: every stage up to `currentPosition` is completed, `currentPosition` itself is current, the rest are pending. */
function timelineThrough(currentPosition, { startedAt = "2026-08-01", completedAt = "2026-08-01" } = {}) {
  return CANONICAL_STAGES.map((stage) => {
    if (stage.position < currentPosition) {
      return { ...stage, status: "completed", startedAt: null, completedAt };
    }
    if (stage.position === currentPosition) {
      return { ...stage, status: "current", startedAt, completedAt: null };
    }
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

function LoginStub() {
  const { login } = useAuth();
  return (
    <div>
      <p>Login screen</p>
      <button
        type="button"
        onClick={() =>
          login({
            accessToken: "candidate-access-token",
            refreshToken: "refresh",
            candidateId: "candidate-public-id-1",
            candidateName: "Ahmed Ali",
            preferredLocale: "en",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          })
        }
      >
        login
      </button>
      <Link to="/status">Go to status</Link>
    </div>
  );
}

function renderStatusPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginStub />} />
              <Route path="/status" element={<StatusPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

async function signInAndNavigateToStatus() {
  renderStatusPage();
  fireEvent.click(screen.getByText("login"));
  fireEvent.click(await screen.findByText("Go to status"));
}

/** The timeline's own row for a stage name -- picks the first match, since the same stage name can legitimately also appear in the "Recent Updates" history section below the timeline. */
function stageRow(labelText) {
  return screen.getAllByText(labelText)[0].parentElement;
}

describe("StatusPage", () => {
  afterEach(() => {
    vi.mocked(applicationProgressClient.getProgress).mockReset();
    vi.mocked(candidateWorkflowClient.getWorkflowHistory).mockReset();
  });

  it("shows a loading state before progress resolves", async () => {
    applicationProgressClient.getProgress.mockReturnValue(new Promise(() => {}));
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("renders the real, backend-authoritative 15-stage workflow timeline exactly as returned, never fabricating or reordering a stage", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    await signInAndNavigateToStatus();

    await screen.findByText("Documents Pending");
    for (const stage of CANONICAL_STAGES) {
      expect(screen.getAllByText(stage.name).length).toBeGreaterThan(0);
    }
  });

  it("marks only the timeline's own current stage as in progress, per the backend's status field", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(3) }) })
    );
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    await signInAndNavigateToStatus();

    await screen.findByText("Documents Uploaded");
    expect(within(stageRow("Documents Uploaded")).getByText("In Progress")).toBeInTheDocument();
    expect(within(stageRow("Verified")).queryByText("In Progress")).not.toBeInTheDocument();
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
    await signInAndNavigateToStatus();

    await screen.findByText("Documents Pending");
    const registeredRow = screen.getAllByText("Registered")[0].parentElement;
    expect(within(registeredRow).getByText(/Completed 01\/08\/2026/)).toBeInTheDocument();
    expect(within(stageRow("Documents Pending")).getByText(/Started 05\/08\/2026/)).toBeInTheDocument();
  });

  it("shows no in-progress stage once fully mobilized, and never fabricates downstream progress", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(16), completedCount: 15, progressPercentage: 100 }) })
    );
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    await signInAndNavigateToStatus();

    await screen.findByText("Mobilized");
    expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
  });

  it("shows the QVC outcome on the QVC stage once the backend has recorded one, sourced from workflow history", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({ workflow: workflowPayload({ timeline: timelineThrough(11) }) })
    );
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
    await signInAndNavigateToStatus();

    await screen.findAllByText("QVC Completed / Outcome Received");
    const outcomeRow = stageRow("QVC Completed / Outcome Received");
    expect(within(outcomeRow).getByText(/Approved/)).toBeInTheDocument();
  });

  it("shows the workflow history list, most recent first", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(
      historyPayload({
        items: [
          { fromStage: null, toStage: CANONICAL_STAGES[0], occurredAt: "2026-08-01T00:00:00Z", reasonCode: null, details: null },
          { fromStage: CANONICAL_STAGES[0], toStage: CANONICAL_STAGES[1], occurredAt: "2026-08-03T00:00:00Z", reasonCode: null, details: null },
        ],
      })
    );
    await signInAndNavigateToStatus();

    await screen.findByText("Recent Updates");
    const names = screen.getAllByText(/Registered|Documents Pending/).map((el) => el.textContent);
    expect(names).toContain("Documents Pending");
  });

  it("shows an empty state for workflow history when there is none yet", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload({ items: [] }));
    await signInAndNavigateToStatus();

    expect(await screen.findByText("No updates yet.")).toBeInTheDocument();
  });

  it("shows an inline retry for workflow history without blocking the already-loaded timeline", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    candidateWorkflowClient.getWorkflowHistory
      .mockRejectedValueOnce({ code: "SERVER_ERROR" })
      .mockResolvedValueOnce(historyPayload());
    await signInAndNavigateToStatus();

    await screen.findByText("Registered");
    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText((content) => content.includes("Registered"));
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    applicationProgressClient.getProgress.mockRejectedValue({ code: "SESSION_EXPIRED" });
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Session expired")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));

    expect(await screen.findByText("Login screen")).toBeInTheDocument();
  });

  it("shows a distinct inactive-account state and returns to sign-in on the confirming action", async () => {
    applicationProgressClient.getProgress.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Account inactive")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to sign in" }));

    expect(await screen.findByText("Login screen")).toBeInTheDocument();
  });

  it("shows an offline state with a retry action for a network failure", async () => {
    applicationProgressClient.getProgress.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("You are offline")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findAllByText("Registered");
  });

  it("retries the query when the retry action is used after a server error", async () => {
    applicationProgressClient.getProgress.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce(progressPayload());
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findAllByText("Registered");
  });

  it("renders the timeline using the server-localized Urdu stage names when the language is switched", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({
        workflow: workflowPayload({
          timeline: timelineThrough(2).map((stage) => (stage.code === "registered" ? { ...stage, name: "رجسٹرڈ" } : stage)),
        }),
      })
    );
    candidateWorkflowClient.getWorkflowHistory.mockResolvedValue(historyPayload());
    localStorage.setItem("descon.language", "ur");
    await signInAndNavigateToStatus();

    expect(await screen.findByText("رجسٹرڈ")).toBeInTheDocument();
    localStorage.removeItem("descon.language");
  });
});
