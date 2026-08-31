import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminWorkflowClient } from "../../../../lib/admin-workflow-client";
import { WorkflowPanel } from "./WorkflowPanel";

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

const MPS = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "mps")!;
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "management")!;
const HR = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "hr")!;

async function signInAs(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function timelineStage(overrides: Record<string, unknown> = {}) {
  return {
    code: "fee_paid",
    name: "Fee Paid",
    position: 7,
    status: "current" as const,
    startedAt: "2026-08-30T09:00:00Z",
    ...overrides,
  };
}

function workflowState(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: "candidate-1",
    assignmentId: "assignment-1",
    candidateStatus: "fee_paid",
    currentStage: timelineStage(),
    timeline: [timelineStage()],
    completedCount: 7,
    totalCount: 15,
    progressPercentage: 46,
    protection: null,
    updatedAt: "2026-08-30T09:00:00Z",
    ...overrides,
  };
}

function qvcAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "qvc-attempt-1",
    attemptNumber: 1,
    appointmentDate: "2026-09-01",
    outcomeCode: null,
    noShow: false,
    outcomeRecordedAt: null,
    status: "scheduled" as const,
    internalNote: null,
    scheduledBy: { id: "staff-1", role: "mps" },
    outcomeRecordedBy: null,
    ...overrides,
  };
}

function qvcAttempts(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: "candidate-1",
    assignmentId: "assignment-1",
    qvcAttempts: [],
    updatedAt: "2026-08-30T09:00:00Z",
    ...overrides,
  };
}

function protectionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "protection-1",
    appearedOn: null,
    appearedRecordedAt: null,
    protectedOn: null,
    readyToFlyAt: null,
    ...overrides,
  };
}

function appearedForProtectionTransition(overrides: Record<string, unknown> = {}) {
  return {
    code: "appeared_for_protection",
    name: "Appeared for Protection",
    position: 12,
    requiredFields: ["appeared_for_protection_on"],
    allowed: true,
    blockingReasons: [],
    ...overrides,
  };
}

function protectedReadyToFlyTransition(overrides: Record<string, unknown> = {}) {
  return {
    code: "protected_ready_to_fly",
    name: "Protected / Ready to Fly",
    position: 13,
    requiredFields: ["protected_on"],
    allowed: true,
    blockingReasons: [],
    ...overrides,
  };
}

function qatarBuTransition(overrides: Record<string, unknown> = {}) {
  return {
    code: "documents_shared_with_qatar_bu",
    name: "Documents Shared with Qatar BU",
    position: 8,
    requiredFields: [],
    allowed: true,
    blockingReasons: [],
    ...overrides,
  };
}

function allowedTransitions(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: "candidate-1",
    updatedAt: "2026-08-30T09:00:00Z",
    allowedNextTransitions: [qatarBuTransition()],
    ...overrides,
  };
}

function historyItem(overrides: Record<string, unknown> = {}) {
  return {
    fromStage: { code: "verified", name: "Verified", position: 5 },
    toStage: { code: "fee_paid", name: "Fee Paid", position: 7 },
    occurredAt: "2026-08-29T09:00:00Z",
    reasonCode: null,
    details: null,
    actor: { id: "staff-1", role: "mps" },
    ...overrides,
  };
}

function workflowHistory(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: "candidate-1",
    assignmentId: "assignment-1",
    history: [historyItem()],
    updatedAt: "2026-08-29T09:00:00Z",
    ...overrides,
  };
}

function transitionResult(overrides: Record<string, unknown> = {}) {
  return {
    workflow: workflowState({
      candidateStatus: "documents_shared_with_qatar_bu",
      currentStage: timelineStage({ code: "documents_shared_with_qatar_bu", name: "Documents Shared with Qatar BU", position: 8 }),
    }),
    transition: historyItem({
      fromStage: { code: "fee_paid", name: "Fee Paid", position: 7 },
      toStage: { code: "documents_shared_with_qatar_bu", name: "Documents Shared with Qatar BU", position: 8 },
      occurredAt: "2026-08-30T09:00:00Z",
      reasonCode: "qatar_bu_shared",
      actor: { id: "staff-2", role: "mps" },
    }),
    ...overrides,
  };
}

function renderPanel(client: ReturnType<typeof createMockStaffAuthClient> extends Promise<infer T> ? T : never) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <WorkflowPanel candidateId="candidate-1" />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("WorkflowPanel", () => {
  // Most tests here aren't exercising the QVC panel at all -- default it to
  // an empty, already-resolved attempts list so they don't need to set this
  // up themselves; QVC-focused tests below override with their own mock.
  beforeEach(() => {
    adminWorkflowClient.getQvcAttempts.mockResolvedValue(qvcAttempts());
  });

  afterEach(() => {
    vi.mocked(adminWorkflowClient.getWorkflowState).mockReset();
    vi.mocked(adminWorkflowClient.getAllowedTransitions).mockReset();
    vi.mocked(adminWorkflowClient.getWorkflowHistory).mockReset();
    vi.mocked(adminWorkflowClient.submitTransition).mockReset();
    vi.mocked(adminWorkflowClient.getQvcAttempts).mockReset();
    vi.mocked(adminWorkflowClient.scheduleQvcAppointment).mockReset();
    vi.mocked(adminWorkflowClient.recordQvcOutcome).mockReset();
    localStorage.removeItem("descon.language");
  });

  it("shows a loading state before the available transitions resolve", async () => {
    adminWorkflowClient.getWorkflowState.mockReturnValue(new Promise(() => {}));
    adminWorkflowClient.getAllowedTransitions.mockReturnValue(new Promise(() => {}));
    adminWorkflowClient.getWorkflowHistory.mockReturnValue(new Promise(() => {}));
    const client = await signInAs(MPS);

    renderPanel(client);

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("shows the no-available-transitions empty state", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
    adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions({ allowedNextTransitions: [] }));
    adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
    const client = await signInAs(MPS);

    renderPanel(client);

    expect(await screen.findByText("No available transitions")).toBeInTheDocument();
  });

  it("shows the Qatar BU card as allowed, with a Confirm action, for a staff member with manage_workflow", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
    adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
    adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
    const client = await signInAs(MPS);

    renderPanel(client);

    expect(await screen.findByText("Documents Shared with Qatar BU")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm sharing" })).toBeInTheDocument();
  });

  it("shows the Qatar BU card as blocked, with the exact blocking reasons and no action, when the backend disallows it", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
    adminWorkflowClient.getAllowedTransitions.mockResolvedValue(
      allowedTransitions({ allowedNextTransitions: [qatarBuTransition({ allowed: false, blockingReasons: ["payment_required", "expired_pcc"] })] })
    );
    adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
    const client = await signInAs(MPS);

    renderPanel(client);

    await screen.findByText("Documents Shared with Qatar BU");
    expect(screen.getByText("Payment has not been recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm sharing" })).not.toBeInTheDocument();
  });

  it("never renders the current stage's raw status code -- always a translated label", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState({ currentStage: timelineStage({ status: "current" }) }));
    adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
    adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
    const client = await signInAs(MPS);

    renderPanel(client);

    expect(await screen.findByText("In Progress")).toBeInTheDocument();
    expect(screen.queryByText("current")).not.toBeInTheDocument();
  });

  it("never infers eligibility client-side -- an allowed:false response hides the action even though the frontend has no other reason to think it's blocked", async () => {
    adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
    adminWorkflowClient.getAllowedTransitions.mockResolvedValue(
      allowedTransitions({ allowedNextTransitions: [qatarBuTransition({ allowed: false, blockingReasons: [] })] })
    );
    adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
    const client = await signInAs(MPS);

    renderPanel(client);

    await screen.findByText("Documents Shared with Qatar BU");
    expect(screen.queryByRole("button", { name: "Confirm sharing" })).not.toBeInTheDocument();
  });

  describe("role-based action visibility", () => {
    it("shows the transition read-only, with a view-only notice and no Confirm action, for a staff member with only view_workflow", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MANAGEMENT);

      renderPanel(client);

      await screen.findByText("Documents Shared with Qatar BU");
      expect(screen.queryByRole("button", { name: "Confirm sharing" })).not.toBeInTheDocument();
      expect(screen.getByText("You don't have permission to perform this transition.")).toBeInTheDocument();
    });

    it("shows a forbidden state for a staff member with neither view_workflow nor manage_workflow", async () => {
      adminWorkflowClient.getWorkflowState.mockRejectedValue({ code: "FORBIDDEN" });
      adminWorkflowClient.getAllowedTransitions.mockRejectedValue({ code: "FORBIDDEN" });
      adminWorkflowClient.getWorkflowHistory.mockRejectedValue({ code: "FORBIDDEN" });
      const client = await signInAs(HR);

      renderPanel(client);

      expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    });
  });

  describe("confirmation and submission", () => {
    it("opens the confirm dialog, cancels without submitting, then reopens and confirms successfully", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.submitTransition.mockResolvedValue(transitionResult());
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Documents Shared with Qatar BU");

      fireEvent.click(screen.getByRole("button", { name: "Confirm sharing" }));
      expect(await screen.findByText("Share documents with Qatar BU?")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByText("Share documents with Qatar BU?")).not.toBeInTheDocument());
      expect(adminWorkflowClient.submitTransition).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Confirm sharing" }));
      await screen.findByText("Share documents with Qatar BU?");
      const dialogConfirmButtons = screen.getAllByRole("button", { name: "Confirm sharing" });
      fireEvent.click(dialogConfirmButtons[dialogConfirmButtons.length - 1]);

      await waitFor(() => expect(adminWorkflowClient.submitTransition).toHaveBeenCalledTimes(1));
      expect(adminWorkflowClient.submitTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: "candidate-1",
          toStageCode: "documents_shared_with_qatar_bu",
          expectedCurrentStageCode: "fee_paid",
        })
      );
      await waitFor(() => expect(screen.queryByText("Share documents with Qatar BU?")).not.toBeInTheDocument());
    });

    it("submits expected_current_stage_code from the currently-loaded workflow state", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState({ currentStage: timelineStage({ code: "verified", name: "Verified", position: 5 }) }));
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.submitTransition.mockResolvedValue(transitionResult());
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Documents Shared with Qatar BU");

      fireEvent.click(screen.getByRole("button", { name: "Confirm sharing" }));
      await screen.findByText("Share documents with Qatar BU?");
      const dialogConfirmButtons = screen.getAllByRole("button", { name: "Confirm sharing" });
      fireEvent.click(dialogConfirmButtons[dialogConfirmButtons.length - 1]);

      await waitFor(() =>
        expect(adminWorkflowClient.submitTransition).toHaveBeenCalledWith(
          expect.objectContaining({ expectedCurrentStageCode: "verified" })
        )
      );
    });

    it("prevents a duplicate submission while the request is pending", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      let resolveSubmit: (value: unknown) => void;
      adminWorkflowClient.submitTransition.mockReturnValue(
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
      );
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Documents Shared with Qatar BU");

      fireEvent.click(screen.getByRole("button", { name: "Confirm sharing" }));
      await screen.findByText("Share documents with Qatar BU?");
      const dialogConfirmButtons = screen.getAllByRole("button", { name: "Confirm sharing" });
      const dialogConfirm = dialogConfirmButtons[dialogConfirmButtons.length - 1];
      fireEvent.click(dialogConfirm);
      fireEvent.click(dialogConfirm);
      fireEvent.click(dialogConfirm);

      await waitFor(() => expect(adminWorkflowClient.submitTransition).toHaveBeenCalledTimes(1));
      resolveSubmit!(transitionResult());
    });

    it("reuses the same idempotency key across a retry of the identical intended transition", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.submitTransition.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce(transitionResult());
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Documents Shared with Qatar BU");

      fireEvent.click(screen.getByRole("button", { name: "Confirm sharing" }));
      await screen.findByText("Share documents with Qatar BU?");
      const firstButtons = screen.getAllByRole("button", { name: "Confirm sharing" });
      fireEvent.click(firstButtons[firstButtons.length - 1]);
      await waitFor(() => expect(adminWorkflowClient.submitTransition).toHaveBeenCalledTimes(1));

      const retryButtons = screen.getAllByRole("button", { name: "Confirm sharing" });
      fireEvent.click(retryButtons[retryButtons.length - 1]);
      await waitFor(() => expect(adminWorkflowClient.submitTransition).toHaveBeenCalledTimes(2));

      const [firstCall, secondCall] = adminWorkflowClient.submitTransition.mock.calls;
      expect(firstCall[0].idempotencyKey).toBe(secondCall[0].idempotencyKey);
    });
  });

  describe("stale state", () => {
    it("does not silently resubmit on a stale-stage conflict -- it closes the dialog, refreshes the workflow, and asks the user to review the new state", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.submitTransition.mockRejectedValue({ code: "WORKFLOW_TRANSITION_STALE" });
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Documents Shared with Qatar BU");

      const stateCallsBefore = adminWorkflowClient.getWorkflowState.mock.calls.length;
      const transitionsCallsBefore = adminWorkflowClient.getAllowedTransitions.mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: "Confirm sharing" }));
      await screen.findByText("Share documents with Qatar BU?");
      const dialogButtons = screen.getAllByRole("button", { name: "Confirm sharing" });
      fireEvent.click(dialogButtons[dialogButtons.length - 1]);

      await waitFor(() => expect(screen.queryByText("Share documents with Qatar BU?")).not.toBeInTheDocument());
      expect(
        await screen.findByText("The workflow changed before this could be applied. Review the updated state below before trying again.")
      ).toBeInTheDocument();
      await waitFor(() => expect(adminWorkflowClient.getWorkflowState.mock.calls.length).toBeGreaterThan(stateCallsBefore));
      await waitFor(() => expect(adminWorkflowClient.getAllowedTransitions.mock.calls.length).toBeGreaterThan(transitionsCallsBefore));
    });
  });

  describe("prerequisite and validation errors", () => {
    it("shows a clear message and keeps the dialog open on a prerequisite-missing error", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.submitTransition.mockRejectedValue({
        code: "WORKFLOW_TRANSITION_PREREQUISITE_MISSING",
        prerequisite: { toStageCode: "documents_shared_with_qatar_bu", requiredFields: [], blockingReasons: ["payment_required"] },
      });
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Documents Shared with Qatar BU");

      fireEvent.click(screen.getByRole("button", { name: "Confirm sharing" }));
      await screen.findByText("Share documents with Qatar BU?");
      const dialogButtons = screen.getAllByRole("button", { name: "Confirm sharing" });
      fireEvent.click(dialogButtons[dialogButtons.length - 1]);

      // Prerequisite-missing is treated the same as stale (terminal, refresh + review) --
      // the dialog closes rather than staying open on data the backend just rejected.
      await waitFor(() => expect(screen.queryByText("Share documents with Qatar BU?")).not.toBeInTheDocument());
    });

    it("shows an idempotency-conflict message inline and keeps the dialog open for a fresh retry", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.submitTransition.mockRejectedValue({ code: "IDEMPOTENCY_CONFLICT" });
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Documents Shared with Qatar BU");

      fireEvent.click(screen.getByRole("button", { name: "Confirm sharing" }));
      await screen.findByText("Share documents with Qatar BU?");
      const dialogButtons = screen.getAllByRole("button", { name: "Confirm sharing" });
      fireEvent.click(dialogButtons[dialogButtons.length - 1]);

      expect(await screen.findByText("This request couldn't be repeated safely. Confirm again to make a fresh attempt.")).toBeInTheDocument();
      expect(screen.getByText("Share documents with Qatar BU?")).toBeInTheDocument();
    });
  });

  describe("forbidden and expired sessions", () => {
    it("shows a forbidden state when the backend reports the staff member cannot view workflow data", async () => {
      adminWorkflowClient.getWorkflowState.mockRejectedValue({ code: "FORBIDDEN" });
      adminWorkflowClient.getAllowedTransitions.mockRejectedValue({ code: "FORBIDDEN" });
      adminWorkflowClient.getWorkflowHistory.mockRejectedValue({ code: "FORBIDDEN" });
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    });
  });

  describe("offline and retry", () => {
    it("shows an offline state with a retry action that refetches all three queries", async () => {
      adminWorkflowClient.getWorkflowState
        .mockRejectedValueOnce({ code: "OFFLINE" })
        .mockResolvedValueOnce(workflowState());
      adminWorkflowClient.getAllowedTransitions
        .mockRejectedValueOnce({ code: "OFFLINE" })
        .mockResolvedValueOnce(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory
        .mockRejectedValueOnce({ code: "OFFLINE" })
        .mockResolvedValueOnce(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("You are offline")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await screen.findByText("Documents Shared with Qatar BU");
    });
  });

  describe("Urdu / RTL rendering", () => {
    it("renders the panel in Urdu when that is the persisted language", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      localStorage.setItem("descon.language", "ur");
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("ورک فلو")).toBeInTheDocument();
      expect(screen.getByText("دستیاب تبدیلیاں")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "شیئرنگ کی تصدیق کریں" })).toBeInTheDocument();
    });

    it("shows the Urdu blocking-reason translation, never a raw backend code", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(
        allowedTransitions({ allowedNextTransitions: [qatarBuTransition({ allowed: false, blockingReasons: ["payment_required"] })] })
      );
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      localStorage.setItem("descon.language", "ur");
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("ادائیگی ابھی درج نہیں ہوئی۔")).toBeInTheDocument();
      expect(screen.queryByText("payment_required")).not.toBeInTheDocument();
    });
  });

  describe("keyboard accessibility", () => {
    it("renders the Confirm action as a real, focusable button reachable by keyboard", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      const confirmButton = await screen.findByRole("button", { name: "Confirm sharing" });
      expect(confirmButton.tagName).toBe("BUTTON");
      confirmButton.focus();
      expect(confirmButton).toHaveFocus();
    });
  });

  describe("actor and timestamp display", () => {
    it("shows the last transition's actor role and timestamp, never a raw role code or personal name", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      await screen.findByText("Documents Shared with Qatar BU");
      const actorMentions = await screen.findAllByText(/MPS/);
      expect(actorMentions.length).toBeGreaterThan(0);
      expect(screen.queryByText("staff-1")).not.toBeInTheDocument();
    });
  });

  describe("QVC panel", () => {
    it("shows the empty state when no appointments have been scheduled yet", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("No QVC appointments have been scheduled yet.")).toBeInTheDocument();
    });

    it("lists an attempt with a translated status, actor role, and never a raw backend status code", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.getQvcAttempts.mockResolvedValue(
        qvcAttempts({ qvcAttempts: [qvcAttempt({ status: "re_medical", outcomeCode: "re_medical" })] })
      );
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("Re-medical required")).toBeInTheDocument();
      expect(screen.queryByText("re_medical")).not.toBeInTheDocument();
    });

    it("shows Schedule appointment for a manage_workflow user when there is no open attempt", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const mps = await signInAs(MPS);

      renderPanel(mps);

      expect(await screen.findByRole("button", { name: "Schedule appointment" })).toBeInTheDocument();
    });

    it("hides Schedule appointment for a view-only staff member even with an open attempt present", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.getQvcAttempts.mockResolvedValue(qvcAttempts({ qvcAttempts: [qvcAttempt()] }));
      const management = await signInAs(MANAGEMENT);

      renderPanel(management);

      await screen.findByText("Documents Shared with Qatar BU");
      expect(screen.queryByRole("button", { name: "Schedule appointment" })).not.toBeInTheDocument();
    });

    it("schedules an appointment, sending the entered date and the current stage code, then closes and shows success", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.scheduleQvcAppointment.mockResolvedValue({
        workflow: workflowState({ currentStage: timelineStage({ code: "qvc_appointment_booked" }) }),
        transition: historyItem({ toStage: { code: "qvc_appointment_booked", name: "QVC Appointment Booked", position: 9 } }),
        qvcAttempt: null,
      });
      const client = await signInAs(MPS);
      renderPanel(client);

      fireEvent.click(await screen.findByRole("button", { name: "Schedule appointment" }));
      await screen.findByText("Schedule a QVC appointment");
      fireEvent.change(screen.getByLabelText("Appointment date"), { target: { value: "2026-09-05" } });
      fireEvent.click(screen.getByRole("button", { name: "Schedule" }));

      await waitFor(() =>
        expect(adminWorkflowClient.scheduleQvcAppointment).toHaveBeenCalledWith(
          expect.objectContaining({ candidateId: "candidate-1", appointmentDate: "2026-09-05", expectedCurrentStageCode: "fee_paid" })
        )
      );
      await waitFor(() => expect(screen.queryByText("Schedule a QVC appointment")).not.toBeInTheDocument());
    });

    it("requires an appointment date client-side before submitting", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);
      renderPanel(client);

      fireEvent.click(await screen.findByRole("button", { name: "Schedule appointment" }));
      await screen.findByText("Schedule a QVC appointment");
      fireEvent.click(screen.getByRole("button", { name: "Schedule" }));

      expect(await screen.findByText("Enter the appointment date.")).toBeInTheDocument();
      expect(adminWorkflowClient.scheduleQvcAppointment).not.toHaveBeenCalled();
    });

    it("prevents a duplicate schedule submission while the request is pending", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      let resolveSchedule: (value: unknown) => void;
      adminWorkflowClient.scheduleQvcAppointment.mockReturnValue(
        new Promise((resolve) => {
          resolveSchedule = resolve;
        })
      );
      const client = await signInAs(MPS);
      renderPanel(client);

      fireEvent.click(await screen.findByRole("button", { name: "Schedule appointment" }));
      await screen.findByText("Schedule a QVC appointment");
      fireEvent.change(screen.getByLabelText("Appointment date"), { target: { value: "2026-09-05" } });
      const confirmButton = screen.getByRole("button", { name: "Schedule" });
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      await waitFor(() => expect(adminWorkflowClient.scheduleQvcAppointment).toHaveBeenCalledTimes(1));
      resolveSchedule!({ workflow: workflowState(), transition: null, qvcAttempt: qvcAttempt() });
    });

    it("closes the dialog and shows the stale-state notice instead of silently resubmitting", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.scheduleQvcAppointment.mockRejectedValue({ code: "WORKFLOW_TRANSITION_STALE" });
      const client = await signInAs(MPS);
      renderPanel(client);

      fireEvent.click(await screen.findByRole("button", { name: "Schedule appointment" }));
      await screen.findByText("Schedule a QVC appointment");
      fireEvent.change(screen.getByLabelText("Appointment date"), { target: { value: "2026-09-05" } });
      fireEvent.click(screen.getByRole("button", { name: "Schedule" }));

      await waitFor(() => expect(screen.queryByText("Schedule a QVC appointment")).not.toBeInTheDocument());
      expect(
        await screen.findByText("The workflow changed before this could be applied. Review the updated state below before trying again.")
      ).toBeInTheDocument();
    });

    it("shows Record outcome only on the open attempt, and records a no-show outcome distinctly from a normal outcome", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.getQvcAttempts.mockResolvedValue(
        qvcAttempts({ qvcAttempts: [qvcAttempt({ id: "attempt-open", status: "scheduled" })] })
      );
      adminWorkflowClient.recordQvcOutcome.mockResolvedValue({
        workflow: workflowState({ currentStage: timelineStage({ code: "qvc_appointment_booked" }) }),
        transition: null,
        qvcAttempt: qvcAttempt({ id: "attempt-open", status: "no_show", noShow: true }),
      });
      const client = await signInAs(MPS);
      renderPanel(client);

      fireEvent.click(await screen.findByRole("button", { name: "Record outcome" }));
      await screen.findByText("Record QVC outcome");
      fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "no_show" } });
      fireEvent.click(screen.getByRole("button", { name: "Save outcome" }));

      await waitFor(() =>
        expect(adminWorkflowClient.recordQvcOutcome).toHaveBeenCalledWith(
          expect.objectContaining({ qvcAttemptId: "attempt-open", outcomeCode: undefined, noShow: true })
        )
      );
    });

    it("requires an outcome selection client-side before submitting", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.getQvcAttempts.mockResolvedValue(qvcAttempts({ qvcAttempts: [qvcAttempt()] }));
      const client = await signInAs(MPS);
      renderPanel(client);

      fireEvent.click(await screen.findByRole("button", { name: "Record outcome" }));
      await screen.findByText("Record QVC outcome");
      fireEvent.click(screen.getByRole("button", { name: "Save outcome" }));

      expect(await screen.findByText("Select an outcome.")).toBeInTheDocument();
      expect(adminWorkflowClient.recordQvcOutcome).not.toHaveBeenCalled();
    });

    it("shows an offline state with retry for the QVC attempts list independent of the rest of the panel", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState());
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.getQvcAttempts.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(qvcAttempts());
      const client = await signInAs(MPS);

      renderPanel(client);

      await screen.findByText("Documents Shared with Qatar BU");
      const offlineMessages = await screen.findAllByText("You are offline");
      expect(offlineMessages.length).toBeGreaterThan(0);
      const retryButtons = screen.getAllByRole("button", { name: "Retry" });
      fireEvent.click(retryButtons[retryButtons.length - 1]);

      await waitFor(() => expect(screen.getByText("No QVC appointments have been scheduled yet.")).toBeInTheDocument());
    });
  });

  describe("Protection panel", () => {
    it("shows existing protection details when present, and a no-details message otherwise", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(
        workflowState({ protection: protectionRecord({ appearedOn: "2026-09-01", protectedOn: "2026-09-05" }) })
      );
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("Protection details")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText(/01-Sept-2026/)).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText(/05-Sept-2026/)).toBeInTheDocument());
    });

    it("shows no protection details recorded yet when the workflow state has none", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(workflowState({ protection: null }));
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions());
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("No protection details recorded yet.")).toBeInTheDocument();
    });

    it("shows the appeared-for-protection card only when the backend returns it as an available transition", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(
        workflowState({ currentStage: timelineStage({ code: "qvc_completed_outcome_received", position: 10 }) })
      );
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions({ allowedNextTransitions: [appearedForProtectionTransition()] }));
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      expect(await screen.findByText("Appeared for Protection")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm appearance" })).toBeInTheDocument();
    });

    // Regression test: allowed_next_transitions evaluates prerequisites with
    // *no* evidence (it can't know what a caller is about to submit), so a
    // stage whose only requirement is its own evidence field always comes
    // back allowed:false with exactly one "<field>_required" blocking
    // reason -- confirmed against the real backend. That must still show
    // the action (the dialog is where the evidence gets supplied), not hide
    // it as if genuinely blocked.
    it("still shows the action when the only blocking reason is the card's own required evidence field", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(
        workflowState({ currentStage: timelineStage({ code: "qvc_completed_outcome_received", position: 10 }) })
      );
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(
        allowedTransitions({
          allowedNextTransitions: [
            appearedForProtectionTransition({ allowed: false, blockingReasons: ["appeared_for_protection_on_required"] }),
          ],
        })
      );
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      await screen.findByText("Appeared for Protection");
      expect(screen.getByRole("button", { name: "Confirm appearance" })).toBeInTheDocument();
      expect(screen.queryByText("This transition is currently blocked.")).not.toBeInTheDocument();
    });

    it("confirms protection appearance, sending the entered date as appeared_for_protection_on evidence", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(
        workflowState({ currentStage: timelineStage({ code: "qvc_completed_outcome_received", position: 10 }) })
      );
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions({ allowedNextTransitions: [appearedForProtectionTransition()] }));
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.submitTransition.mockResolvedValue(
        transitionResult({ workflow: workflowState({ currentStage: timelineStage({ code: "appeared_for_protection", position: 12 }) }) })
      );
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Appeared for Protection");

      fireEvent.click(screen.getByRole("button", { name: "Confirm appearance" }));
      await screen.findByText("Confirm protection appearance");
      fireEvent.change(screen.getByLabelText("Appearance date"), { target: { value: "2026-09-10" } });
      const dialogButtons = screen.getAllByRole("button", { name: "Confirm appearance" });
      fireEvent.click(dialogButtons[dialogButtons.length - 1]);

      await waitFor(() =>
        expect(adminWorkflowClient.submitTransition).toHaveBeenCalledWith(
          expect.objectContaining({
            toStageCode: "appeared_for_protection",
            expectedCurrentStageCode: "qvc_completed_outcome_received",
            evidence: { appeared_for_protection_on: "2026-09-10" },
          })
        )
      );
    });

    it("requires the appearance date client-side before submitting", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(
        workflowState({ currentStage: timelineStage({ code: "qvc_completed_outcome_received", position: 10 }) })
      );
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions({ allowedNextTransitions: [appearedForProtectionTransition()] }));
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Appeared for Protection");

      fireEvent.click(screen.getByRole("button", { name: "Confirm appearance" }));
      await screen.findByText("Confirm protection appearance");
      const dialogButtons = screen.getAllByRole("button", { name: "Confirm appearance" });
      fireEvent.click(dialogButtons[dialogButtons.length - 1]);

      expect(await screen.findByText("Enter the date.")).toBeInTheDocument();
      expect(adminWorkflowClient.submitTransition).not.toHaveBeenCalled();
    });

    it("shows the protected/ready-to-fly card with its own date field and evidence key", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(
        workflowState({ currentStage: timelineStage({ code: "appeared_for_protection", position: 12 }) })
      );
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions({ allowedNextTransitions: [protectedReadyToFlyTransition()] }));
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      adminWorkflowClient.submitTransition.mockResolvedValue(transitionResult());
      const client = await signInAs(MPS);
      renderPanel(client);
      await screen.findByText("Protected / Ready to Fly");

      fireEvent.click(screen.getByRole("button", { name: "Confirm ready to fly" }));
      await screen.findByText("Confirm protected / ready to fly");
      fireEvent.change(screen.getByLabelText("Protected date"), { target: { value: "2026-09-12" } });
      const dialogButtons = screen.getAllByRole("button", { name: "Confirm ready to fly" });
      fireEvent.click(dialogButtons[dialogButtons.length - 1]);

      await waitFor(() =>
        expect(adminWorkflowClient.submitTransition).toHaveBeenCalledWith(
          expect.objectContaining({ toStageCode: "protected_ready_to_fly", evidence: { protected_on: "2026-09-12" } })
        )
      );
    });

    it("hides the action and shows the view-only notice for a staff member without manage_workflow", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(
        workflowState({ currentStage: timelineStage({ code: "qvc_completed_outcome_received", position: 10 }) })
      );
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(allowedTransitions({ allowedNextTransitions: [appearedForProtectionTransition()] }));
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MANAGEMENT);

      renderPanel(client);

      await screen.findByText("Appeared for Protection");
      expect(screen.queryByRole("button", { name: "Confirm appearance" })).not.toBeInTheDocument();
      expect(screen.getByText("You don't have permission to perform this transition.")).toBeInTheDocument();
    });

    it("shows the exact blocking reasons and no action when the backend disallows the transition", async () => {
      adminWorkflowClient.getWorkflowState.mockResolvedValue(
        workflowState({ currentStage: timelineStage({ code: "qvc_completed_outcome_received", position: 10 }) })
      );
      adminWorkflowClient.getAllowedTransitions.mockResolvedValue(
        allowedTransitions({
          allowedNextTransitions: [appearedForProtectionTransition({ allowed: false, blockingReasons: ["qvc_approval_required"] })],
        })
      );
      adminWorkflowClient.getWorkflowHistory.mockResolvedValue(workflowHistory());
      const client = await signInAs(MPS);

      renderPanel(client);

      await screen.findByText("Appeared for Protection");
      expect(screen.queryByRole("button", { name: "Confirm appearance" })).not.toBeInTheDocument();
      expect(screen.getByText("This transition is currently blocked.")).toBeInTheDocument();
    });
  });
});
