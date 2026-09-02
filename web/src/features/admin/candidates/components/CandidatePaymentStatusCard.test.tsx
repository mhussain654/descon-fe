import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { adminWorkflowClient } from "../../../../lib/admin-workflow-client";
import { CandidatePaymentStatusCard } from "./CandidatePaymentStatusCard";

vi.mock("../../../../lib/admin-workflow-client", () => ({
  adminWorkflowClient: {
    getWorkflowState: vi.fn(),
    getAllowedTransitions: vi.fn(),
    getWorkflowHistory: vi.fn(),
    submitTransition: vi.fn(),
    getQvcAttempts: vi.fn(),
    scheduleQvcAppointment: vi.fn(),
    recordQvcOutcome: vi.fn(),
    getVisaDecisions: vi.fn(),
    recordVisaDecision: vi.fn(),
    getVisaCopyAccess: vi.fn(),
    getFlightDetail: vi.fn(),
    recordFlightDetail: vi.fn(),
    mobilizeFlightDetail: vi.fn(),
    getFlightTicketAccess: vi.fn(),
  },
}));

function stage(code: string, status: "completed" | "current" | "pending", overrides: Record<string, unknown> = {}) {
  return { code, name: code, position: 1, status, ...overrides };
}

function workflowState(timeline: ReturnType<typeof stage>[]) {
  return {
    candidateId: "candidate-1",
    assignmentId: "assignment-1",
    candidateStatus: "documents_pending",
    currentStage: timeline.find((s) => s.status === "current") ?? null,
    timeline,
    completedCount: 0,
    totalCount: timeline.length,
    progressPercentage: 0,
    protection: null,
    updatedAt: "2026-08-30T09:00:00Z",
  };
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CandidatePaymentStatusCard candidateId="candidate-1" />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("CandidatePaymentStatusCard", () => {
  afterEach(() => {
    vi.mocked(adminWorkflowClient.getWorkflowState).mockReset();
  });

  it("shows Paid when fee_paid is the current stage", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(
      workflowState([stage("fee_pending", "completed"), stage("fee_paid", "current")])
    );
    renderCard();

    expect(await screen.findByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("shows Paid when fee_paid is completed (the candidate has advanced further)", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(
      workflowState([stage("fee_paid", "completed"), stage("documents_shared_with_qatar_bu", "current")])
    );
    renderCard();

    expect(await screen.findByText("Paid")).toBeInTheDocument();
  });

  it("shows Pending when fee_pending is the current stage", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(
      workflowState([stage("verified", "completed"), stage("fee_pending", "current"), stage("fee_paid", "pending")])
    );
    renderCard();

    expect(await screen.findByText("Pending")).toBeInTheDocument();
  });

  it("shows Not yet due before the candidate has reached fee_pending", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(
      workflowState([stage("registered", "completed"), stage("documents_pending", "current"), stage("fee_pending", "pending")])
    );
    renderCard();

    expect(await screen.findByText("Not yet due")).toBeInTheDocument();
  });

  it("renders nothing while loading, on error, or with no data -- WorkflowPanel already surfaces the real error state", async () => {
    adminWorkflowClient.getWorkflowState.mockRejectedValue({ code: "FORBIDDEN" });
    const { container } = renderCard();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders in Urdu", async () => {
    localStorage.setItem("descon.language", "ur");
    adminWorkflowClient.getWorkflowState.mockResolvedValue(
      workflowState([stage("fee_pending", "completed"), stage("fee_paid", "current")])
    );
    renderCard();

    expect(await screen.findByText("ادائیگی")).toBeInTheDocument();
    expect(screen.getByText("ادا شدہ")).toBeInTheDocument();
    localStorage.removeItem("descon.language");
  });
});
