import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { applicationProgressClient } from "../../lib/application-progress-client";
import StatusPage from "./page";

vi.mock("../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: vi.fn(), submitDocuments: vi.fn() },
}));

function progressPayload(overrides = {}) {
  return {
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
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
      ...overrides,
    },
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

function stageRow(labelText) {
  return screen.getByText(labelText).parentElement;
}

describe("StatusPage", () => {
  afterEach(() => {
    vi.mocked(applicationProgressClient.getProgress).mockReset();
  });

  it("shows a loading state before progress resolves", async () => {
    applicationProgressClient.getProgress.mockReturnValue(new Promise(() => {}));
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("renders the full approved-prototype timeline, including the downstream stages that have no backend data yet", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Registered")).toBeInTheDocument();
    expect(screen.getByText("Documents Pending")).toBeInTheDocument();
    expect(screen.getByText("Documents Uploaded")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    // The prototype's downstream stages (fee/QVC/visa/mobilization) have no
    // backing field in the real contract, so they render as plain, un-dated
    // upcoming stages rather than being hidden or fabricated as reached.
    expect(screen.getByText("Fee Pending")).toBeInTheDocument();
    expect(screen.getByText("QVC Appointment Booked")).toBeInTheDocument();
    expect(screen.getByText("Visa Issued")).toBeInTheDocument();
    expect(screen.getByText("Mobilized")).toBeInTheDocument();
  });

  it("marks documents-uploaded as the in-progress stage while documents are incomplete", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ submissionState: "incomplete" }));
    await signInAndNavigateToStatus();

    await screen.findByText("Documents Uploaded");
    expect(within(stageRow("Documents Uploaded")).getByText("In Progress")).toBeInTheDocument();
    expect(within(stageRow("Verified")).queryByText("In Progress")).not.toBeInTheDocument();
  });

  it("marks verified as the in-progress stage once documents are submitted but not yet fully verified", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ submissionState: "partially_verified" }));
    await signInAndNavigateToStatus();

    await screen.findByText("Verified");
    expect(within(stageRow("Verified")).getByText("In Progress")).toBeInTheDocument();
  });

  it("shows no in-progress stage and never fabricates downstream progress once fully verified", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ submissionState: "verified" }));
    await signInAndNavigateToStatus();

    await screen.findByText("Verified");
    expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    applicationProgressClient.getProgress.mockRejectedValue({ code: "SESSION_EXPIRED" });
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Session expired")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));

    expect(await screen.findByText("Login screen")).toBeInTheDocument();
  });

  it("shows a distinct inactive-account state and returns to sign-in on the confirming action", async () => {
    applicationProgressClient.getProgress.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Account inactive")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to sign in" }));

    expect(await screen.findByText("Login screen")).toBeInTheDocument();
  });

  it("shows an offline state with a retry action for a network failure", async () => {
    applicationProgressClient.getProgress.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(progressPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("You are offline")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Registered");
  });

  it("retries the query when the retry action is used after a server error", async () => {
    applicationProgressClient.getProgress.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce(progressPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Registered");
  });

  it("renders the timeline in Urdu when the language is switched", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    localStorage.setItem("descon.language", "ur");
    await signInAndNavigateToStatus();

    expect(await screen.findByText("رجسٹرڈ")).toBeInTheDocument();
    localStorage.removeItem("descon.language");
  });
});
