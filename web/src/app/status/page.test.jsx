import { fireEvent, render, screen } from "@testing-library/react";
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

describe("StatusPage", () => {
  afterEach(() => {
    vi.mocked(applicationProgressClient.getProgress).mockReset();
  });

  it("shows the real, backend-reported workflow stage and progress, not a fabricated multi-stage pipeline", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Documents pending")).toBeInTheDocument();
    // The old prototype's fabricated downstream stages (fee/QVC/visa/
    // mobilization) have no backing endpoint and must never be shown as if
    // they were real status.
    expect(screen.queryByText("QVC Appointment Booked")).not.toBeInTheDocument();
    expect(screen.queryByText("Visa Issued")).not.toBeInTheDocument();
    expect(screen.queryByText("Mobilized")).not.toBeInTheDocument();
  });

  it("shows the verified badge only once the backend reports the submission as verified", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({ verified: 2, missing: 0, uploaded: 0, submittedTotal: 2, submissionState: "verified" })
    );
    await signInAndNavigateToStatus();

    expect(await screen.findByText("Verified", { selector: "span" })).toBeInTheDocument();
  });
});
