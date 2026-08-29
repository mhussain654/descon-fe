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

function profilePayload(overrides = {}) {
  return {
    id: "candidate-public-id-1",
    fullName: "Fatima Bibi",
    maskedCnic: "42101-*******-1",
    referenceNumber: "DES-777001",
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
      requiredTotal: 1,
      missing: 0,
      uploaded: 0,
      pendingReview: 0,
      verified: 0,
      rejected: 0,
      submittedTotal: 0,
      completionPercentage: 0,
      canSubmit: false,
      submissionState: "incomplete",
      blockingRequirements: [],
      ...overrides,
    },
  };
}

function checklistItem(overrides = {}) {
  return {
    requirementCode: "passport",
    name: "Passport",
    required: true,
    status: "missing",
    replacementAllowed: false,
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
            candidateName: "Fatima Bibi",
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

  it("shows the real candidate name and reference number, never the old prototype values", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    await signInAndNavigateToDashboard();

    expect(await screen.findByText("Fatima Bibi")).toBeInTheDocument();
    expect(screen.getByText("DES-777001")).toBeInTheDocument();
    expect(screen.queryByText("Ahmed Khan")).not.toBeInTheDocument();
    expect(screen.queryByText("DES-2026-001")).not.toBeInTheDocument();
  });

  it("suggests replacing a rejected, replaceable document above every other next action", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      checklistItem({ requirementCode: "cnic", name: "CNIC", status: "rejected", replacementAllowed: true }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ rejected: 1 }));
    await signInAndNavigateToDashboard();

    expect(await screen.findByText("Replace your rejected document: CNIC")).toBeInTheDocument();
  });

  it("suggests uploading a missing required document when nothing is rejected", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    await signInAndNavigateToDashboard();

    expect(await screen.findByText("Upload your missing document: Passport")).toBeInTheDocument();
  });

  it("shows verification complete only once the backend reports the submission as verified", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([checklistItem({ status: "verified" })]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({ verified: 1, submissionState: "verified" })
    );
    await signInAndNavigateToDashboard();

    expect(await screen.findByText("Verification complete")).toBeInTheDocument();
  });

  it("still shows the quick actions", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    await signInAndNavigateToDashboard();

    await screen.findByText("Fatima Bibi");
    expect(screen.getByText("Upload Documents")).toBeInTheDocument();
    expect(screen.getByText("View Status")).toBeInTheDocument();
  });
});
