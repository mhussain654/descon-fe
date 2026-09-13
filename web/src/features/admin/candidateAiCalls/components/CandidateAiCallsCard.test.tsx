import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminCandidateAiCallsClient } from "../../../../lib/admin-candidate-ai-calls-client";
import { CandidateAiCallsCard } from "./CandidateAiCallsCard";

vi.mock("../../../../lib/admin-candidate-ai-calls-client", () => ({
  adminCandidateAiCallsClient: { listCandidateAiCalls: vi.fn(), triggerCandidateAiCall: vi.fn() },
}));

const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr" && !account.locked && !account.suspended)!;
const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "finance")!;

async function signInAs(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function renderCard(client: Awaited<ReturnType<typeof signInAs>>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <CandidateAiCallsCard candidateId="candidate-1" />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function call(overrides: Record<string, unknown> = {}) {
  return {
    id: "call-1",
    direction: "outbound" as const,
    callReason: "missing_documents" as const,
    languageCode: "en",
    status: "completed" as const,
    triggeredBy: { id: "staff-1", role: "hr" },
    outcome: "answered" as const,
    outcomeReason: "resolved",
    verificationStatus: "not_applicable" as const,
    summary: undefined,
    startedAt: "2026-09-10T10:00:00Z",
    answeredAt: "2026-09-10T10:00:05Z",
    completedAt: "2026-09-10T10:02:00Z",
    createdAt: "2026-09-10T10:00:00Z",
    ...overrides,
  };
}

describe("CandidateAiCallsCard", () => {
  afterEach(() => {
    vi.mocked(adminCandidateAiCallsClient.listCandidateAiCalls).mockReset();
    vi.mocked(adminCandidateAiCallsClient.triggerCandidateAiCall).mockReset();
    sessionStorage.clear();
  });

  it("renders the call history for a staff member with trigger_ai_calls", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([call()]);
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("AI voice calls")).toBeInTheDocument();
    const list = within(screen.getByRole("list"));
    expect(list.getByText("Missing documents")).toBeInTheDocument();
    expect(list.getByText("Completed")).toBeInTheDocument();
    expect(list.getByText("Answered")).toBeInTheDocument();
  });

  it("shows the empty state when there is no call history yet", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("No admin-triggered calls yet.")).toBeInTheDocument();
  });

  it("renders nothing for a staff member without trigger_ai_calls", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(FINANCE);

    const { container } = renderCard(client);

    await waitFor(() => expect(adminCandidateAiCallsClient.listCandidateAiCalls).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("does not show the trigger control for a staff member without trigger_ai_calls, even if the list call somehow succeeds", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    const client = await signInAs(FINANCE);

    renderCard(client);

    await screen.findByText("No admin-triggered calls yet.");
    expect(screen.queryByLabelText("Call candidate")).not.toBeInTheDocument();
  });

  it("opens a confirm dialog before triggering a call, and triggers it on confirm", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    adminCandidateAiCallsClient.triggerCandidateAiCall.mockResolvedValue(call({ status: "requested", outcome: undefined }));
    const client = await signInAs(HR);

    renderCard(client);
    await screen.findByText("No admin-triggered calls yet.");

    fireEvent.change(screen.getByLabelText("Call candidate"), { target: { value: "flight_information" } });

    expect(await screen.findByText("Place this call?")).toBeInTheDocument();
    expect(screen.getByText("An AI voice call with flight information will be placed to this candidate now.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Call now" }));

    await waitFor(() =>
      expect(adminCandidateAiCallsClient.triggerCandidateAiCall).toHaveBeenCalledWith(
        "candidate-1",
        "flight_information",
        expect.any(String)
      )
    );
    await waitFor(() => expect(screen.queryByText("Place this call?")).not.toBeInTheDocument());
  });

  it("cancelling the confirm dialog does not trigger a call", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    const client = await signInAs(HR);

    renderCard(client);
    await screen.findByText("No admin-triggered calls yet.");

    fireEvent.change(screen.getByLabelText("Call candidate"), { target: { value: "missing_documents" } });
    await screen.findByText("Place this call?");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText("Place this call?")).not.toBeInTheDocument());
    expect(adminCandidateAiCallsClient.triggerCandidateAiCall).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and surfaces the server message on a validation failure", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    adminCandidateAiCallsClient.triggerCandidateAiCall.mockRejectedValue({
      code: "VALIDATION_FAILED",
      message: "This candidate has no current assignment.",
    });
    const client = await signInAs(HR);

    renderCard(client);
    await screen.findByText("No admin-triggered calls yet.");

    fireEvent.change(screen.getByLabelText("Call candidate"), { target: { value: "missing_documents" } });
    await screen.findByText("Place this call?");
    fireEvent.click(screen.getByRole("button", { name: "Call now" }));

    expect(await screen.findByText("This candidate has no current assignment.")).toBeInTheDocument();
  });
});
