import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { candidateProfileClient } from "../../lib/candidate-profile-client";
import { candidateDocumentsClient } from "../../lib/candidate-documents-client";
import { applicationProgressClient } from "../../lib/application-progress-client";
import DashboardPage from "./page";

vi.mock("../../lib/candidate-profile-client", () => ({
  candidateProfileClient: { getProfile: vi.fn() },
}));
vi.mock("../../lib/candidate-documents-client", () => ({
  candidateDocumentsClient: { getChecklist: vi.fn(), uploadDocument: vi.fn() },
}));
vi.mock("../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: vi.fn(), submitDocuments: vi.fn() },
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
      <Link to="/dashboard">Go to dashboard</Link>
    </div>
  );
}

function renderDashboardPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginStub />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

async function signInAndNavigateToDashboard() {
  renderDashboardPage();
  fireEvent.click(screen.getByText("login"));
  fireEvent.click(await screen.findByText("Go to dashboard"));
}

describe("DashboardPage", () => {
  afterEach(() => {
    vi.mocked(candidateProfileClient.getProfile).mockReset();
    vi.mocked(candidateDocumentsClient.getChecklist).mockReset();
    vi.mocked(applicationProgressClient.getProgress).mockReset();
  });

  it("shows the candidate's real name, reference number, real workflow stage and real workflow progress percentage", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem()]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDashboard();

    expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
    expect(screen.getByText("DES-001001")).toBeInTheDocument();
    expect(screen.getByText("Documents Uploaded (In Progress)")).toBeInTheDocument();
    expect(screen.getByText("13% complete")).toBeInTheDocument();
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
    await signInAndNavigateToDashboard();

    expect(await screen.findByText("33% complete")).toBeInTheDocument();
    // "Verified" now legitimately appears twice: the green chip, and the
    // current-status line's last-completed stage name (unambiguous with the
    // in-progress case, which appends "(In Progress)").
    expect(screen.getAllByText("Verified")).toHaveLength(2);
  });

  it("does not show the verified chip while documents are only partially verified", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState: "partially_verified" }) })
    );
    await signInAndNavigateToDashboard();

    await screen.findByText("Ahmed Ali");
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("prompts to upload the missing required document as the highest-priority next step", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDashboard();

    expect(await screen.findByText(/Upload your missing document: Passport/)).toBeInTheDocument();
  });

  it("prompts to replace a rejected, replaceable required document ahead of a missing one", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      checklistItem({ requirementCode: "passport", status: "rejected", replacementAllowed: true }),
      checklistItem({ requirementCode: "cnic_front", name: "CNIC", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDashboard();

    expect(await screen.findByText(/Replace your rejected document: Passport/)).toBeInTheDocument();
  });

  it("shows the waiting-for-verification fallback once fully verified with nothing left to do", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "verified" })]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState: "verified", missing: 0, verified: 1 }) })
    );
    await signInAndNavigateToDashboard();

    expect(await screen.findByText("Verification complete")).toBeInTheDocument();
  });

  it("renders the quick-action link to documents and status, and shows Make Payment as visibly disabled", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDashboard();

    await screen.findByText("Ahmed Ali");
    expect(screen.getByRole("link", { name: /Upload Documents/ })).toHaveAttribute("href", "/documents");
    expect(screen.getByRole("link", { name: /View Status/ })).toHaveAttribute("href", "/status");
    expect(screen.queryByRole("link", { name: /Make Payment/ })).not.toBeInTheDocument();
    expect(screen.getByText("Make Payment")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("shows a dedicated session-expired screen (not a silent redirect) on a session-expired error from any source query, ending the session only once confirmed", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SESSION_EXPIRED" });
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Sign in again" }));
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
  });

  it("renders the dashboard in Urdu when the language is switched", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    localStorage.setItem("descon.language", "ur");
    await signInAndNavigateToDashboard();

    expect(await screen.findByText("خوش آمدید")).toBeInTheDocument();
    localStorage.removeItem("descon.language");
  });
});
