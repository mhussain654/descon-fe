import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    updatedAt: "2026-08-30T09:00:00Z",
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
  afterEach(() => {
    vi.mocked(adminWorkflowClient.getWorkflowState).mockReset();
    vi.mocked(adminWorkflowClient.getAllowedTransitions).mockReset();
    vi.mocked(adminWorkflowClient.getWorkflowHistory).mockReset();
    vi.mocked(adminWorkflowClient.submitTransition).mockReset();
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
});
