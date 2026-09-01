import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminCandidateClient } from "../../../../lib/admin-candidates-client";
import { adminWorkflowClient } from "../../../../lib/admin-workflow-client";
import CandidateDetailsPage from "./page";

// Document verification's own role-gating (previously tested against this
// page's mock "Documents" card) now lives entirely at its real feature --
// /admin/document-reviews/[id] -- which already has its own dedicated
// coverage. This page composes the real CandidateProfileCard (its own
// dedicated test file) and the real WorkflowPanel (its own dedicated test
// file); this file only proves the composition itself works end to end.
vi.mock("../../../../lib/admin-candidates-client", () => ({
  adminCandidateClient: {
    getCandidate: vi.fn(),
    createCandidate: vi.fn(),
    updateCandidate: vi.fn(),
    getCountries: vi.fn(),
    getProjects: vi.fn(),
    getCrafts: vi.fn(),
  },
}));

vi.mock("../../../../lib/admin-workflow-client", () => ({
  adminWorkflowClient: {
    getWorkflowState: vi.fn(),
    getAllowedTransitions: vi.fn(),
    getWorkflowHistory: vi.fn(),
    submitTransition: vi.fn(),
    getQvcAttempts: vi.fn(),
    scheduleQvcAppointment: vi.fn(),
    recordQvcOutcome: vi.fn(),
  },
}));

const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr");

async function renderPage() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: HR.email, password: MOCK_STAFF_PASSWORD });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={["/admin/candidates/candidate-1"]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <CandidateDetailsPage params={{ id: "candidate-1" }} />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("CandidateDetailsPage", () => {
  beforeEach(() => {
    adminCandidateClient.getCandidate.mockResolvedValue({
      id: "candidate-1",
      fullName: "Jane Applicant",
      cnic: "42101-1234567-1",
      mobileNumber: "+923001234567",
      passportNumber: null,
      preferredLocale: "en",
      candidateStatus: "documents_pending",
      active: true,
      createdAt: "2026-08-30T09:00:00Z",
      updatedAt: "2026-08-30T09:00:00Z",
      assignment: null,
    });
    adminWorkflowClient.getWorkflowState.mockResolvedValue({
      candidateId: "candidate-1",
      assignmentId: null,
      candidateStatus: "documents_pending",
      currentStage: { code: "documents_pending", name: "Documents Pending", position: 2, status: "current" },
      timeline: [],
      completedCount: 1,
      totalCount: 15,
      progressPercentage: 6,
      protection: null,
      updatedAt: "2026-08-30T09:00:00Z",
    });
    adminWorkflowClient.getAllowedTransitions.mockResolvedValue({
      candidateId: "candidate-1",
      updatedAt: "2026-08-30T09:00:00Z",
      allowedNextTransitions: [],
    });
    adminWorkflowClient.getWorkflowHistory.mockResolvedValue({
      candidateId: "candidate-1",
      assignmentId: null,
      history: [],
      updatedAt: "2026-08-30T09:00:00Z",
    });
    adminWorkflowClient.getQvcAttempts.mockResolvedValue({
      candidateId: "candidate-1",
      assignmentId: null,
      qvcAttempts: [],
      updatedAt: "2026-08-30T09:00:00Z",
    });
  });

  afterEach(() => {
    vi.mocked(adminCandidateClient.getCandidate).mockReset();
    vi.mocked(adminWorkflowClient.getWorkflowState).mockReset();
    vi.mocked(adminWorkflowClient.getAllowedTransitions).mockReset();
    vi.mocked(adminWorkflowClient.getWorkflowHistory).mockReset();
    vi.mocked(adminWorkflowClient.getQvcAttempts).mockReset();
    sessionStorage.clear();
  });

  it("renders both the real candidate profile and the real workflow panel for the same candidate id", async () => {
    await renderPage();

    expect(await screen.findByText("Jane Applicant")).toBeInTheDocument();
    expect(await screen.findByText("Workflow")).toBeInTheDocument();
    expect(screen.getByText("Documents Pending")).toBeInTheDocument();
  });
});
