import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { adminWorkflowClient } from "../../../../lib/admin-workflow-client";
import { adminFeesClient } from "../../../../lib/admin-fees-client";
import { adminPaymentsClient } from "../../../../lib/admin-payments-client";
import { CandidatePaymentStatusCard } from "./CandidatePaymentStatusCard";

const auth = vi.hoisted(() => ({ denied: new Set<string>() }));
vi.mock("../../../../contexts/StaffAuthContext", () => ({
  useStaffAuth: () => ({ hasPermission: (code: string) => !auth.denied.has(code), signOut: vi.fn() }),
}));
vi.mock("../../../../lib/admin-payments-client", () => ({ adminPaymentsClient: { recordManualPayment: vi.fn() } }));
vi.mock("../../../../lib/admin-fees-client", () => ({ adminFeesClient: { getFee: vi.fn() } }));
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
    getBoardingPassAccess: vi.fn(),
    rejectBoardingPass: vi.fn(),
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
  beforeEach(() => {
    adminFeesClient.getFee.mockResolvedValue({ defaultAmount: '1500.00', effectiveAmount: '1500.00', overrideAmount: null, currencyCode: 'PKR', version: 0, assignmentId: 'assignment-1', locked: false, updatedAt: '2026-10-04T09:00:00Z' });
  });
  afterEach(() => {
    auth.denied.clear();
    vi.mocked(adminPaymentsClient.recordManualPayment).mockReset();
    vi.mocked(adminFeesClient.getFee).mockReset();
    vi.mocked(adminWorkflowClient.getWorkflowState).mockReset();
  });

  it("shows Paid when fee_paid is the current stage", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(
      workflowState([stage("fee_pending", "completed"), stage("fee_paid", "current")])
    );
    renderCard();

    expect(await screen.findByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(await screen.findByText(/1,500/)).toBeInTheDocument();
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

  describe("marking the fee paid by hand (developers only)", () => {
    const pending = () => workflowState([stage("verified", "completed"), stage("fee_pending", "current"), stage("fee_paid", "pending")]);

    it("records the KuickPay reference, paid day and reason, and refreshes the candidate", async () => {
      vi.mocked(adminWorkflowClient.getWorkflowState).mockResolvedValue(pending());
      vi.mocked(adminPaymentsClient.recordManualPayment).mockResolvedValue({ id: "payment-1" } as never);
      renderCard();

      fireEvent.click(await screen.findByRole("button", { name: "Mark as paid" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText("KuickPay reference"), { target: { value: " 788895 " } });
      fireEvent.change(within(dialog).getByLabelText("Paid on"), { target: { value: "2026-11-20" } });
      fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Paid at KuickPay" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Mark as paid" }));

      await waitFor(() =>
        expect(adminPaymentsClient.recordManualPayment).toHaveBeenCalledWith("candidate-1", {
          reference: "788895",
          paidOn: "2026-11-20",
          reason: "Paid at KuickPay",
        })
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(adminWorkflowClient.getWorkflowState).toHaveBeenCalledTimes(2));
    });

    it("asks for the reference and reason before sending, and shows the server's refusal", async () => {
      vi.mocked(adminWorkflowClient.getWorkflowState).mockResolvedValue(pending());
      vi.mocked(adminPaymentsClient.recordManualPayment).mockRejectedValue({
        code: "VALIDATION_FAILED",
        message: "This reference is already recorded on another payment.",
      });
      renderCard();

      fireEvent.click(await screen.findByRole("button", { name: "Mark as paid" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Mark as paid" }));
      expect(within(dialog).getByText("Enter the KuickPay reference.")).toBeInTheDocument();
      expect(within(dialog).getByText("Explain why the payment is being marked as paid.")).toBeInTheDocument();
      expect(adminPaymentsClient.recordManualPayment).not.toHaveBeenCalled();

      fireEvent.change(within(dialog).getByLabelText("KuickPay reference"), { target: { value: "788895" } });
      fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Paid at KuickPay" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Mark as paid" }));
      expect(await within(dialog).findByText("This reference is already recorded on another payment.")).toBeInTheDocument();
    });

    it("is hidden from staff who are not developers, and once the fee is paid", async () => {
      auth.denied.add("record_manual_payment");
      vi.mocked(adminWorkflowClient.getWorkflowState).mockResolvedValue(pending());
      const { unmount } = renderCard();
      expect(await screen.findByText("Pending")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Mark as paid" })).not.toBeInTheDocument();
      unmount();

      auth.denied.clear();
      vi.mocked(adminWorkflowClient.getWorkflowState).mockResolvedValue(
        workflowState([stage("fee_pending", "completed"), stage("fee_paid", "current")])
      );
      renderCard();
      expect(await screen.findByText("Paid")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Mark as paid" })).not.toBeInTheDocument();
    });
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
