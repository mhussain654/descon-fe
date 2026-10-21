import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminCandidateAiCallsClient } from "../../../../lib/admin-candidate-ai-calls-client";
import { adminBulkCallsClient } from "../../../../lib/admin-bulk-calls-client";
import { CandidateAiCallsCard } from "./CandidateAiCallsCard";

vi.mock("../../../../lib/admin-candidate-ai-calls-client", () => ({
  adminCandidateAiCallsClient: { listCandidateAiCalls: vi.fn(), triggerCandidateAiCall: vi.fn() },
}));
vi.mock("../../../../lib/admin-bulk-calls-client", () => ({
  adminBulkCallsClient: { listVoices: vi.fn() },
}));

const VOICES = [
  { id: "voice-1", nameEn: "Upload documents", nameUr: "دستاویزات اپ لوڈ کریں", voiceId: "538", active: true, updatedAt: "2026-10-20T09:00:00Z" },
  { id: "voice-2", nameEn: "Medical report received", voiceId: "537", active: true, updatedAt: "2026-10-20T09:00:00Z" },
  { id: "voice-3", nameEn: "Old call", voiceId: "100", active: false, updatedAt: "2026-10-20T09:00:00Z" },
];

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
    callReason: "voice_call",
    trigger: "manual" as const,
    voice: { voiceId: "538", nameEn: "Upload documents", nameUr: undefined },
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
  beforeEach(() => {
    adminBulkCallsClient.listVoices.mockResolvedValue(VOICES);
  });

  afterEach(() => {
    vi.mocked(adminBulkCallsClient.listVoices).mockReset();
    vi.mocked(adminCandidateAiCallsClient.listCandidateAiCalls).mockReset();
    vi.mocked(adminCandidateAiCallsClient.triggerCandidateAiCall).mockReset();
    sessionStorage.clear();
  });

  it("renders the call history for a staff member with trigger_ai_calls", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([call()]);
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("Call history")).toBeInTheDocument();
    const list = within(screen.getByRole("list"));
    expect(list.getByText("Upload documents")).toBeInTheDocument();
    expect(list.getByText("Called by staff")).toBeInTheDocument();
    expect(list.getByText("Completed")).toBeInTheDocument();
    expect(list.getByText("Answered")).toBeInTheDocument();
  });

  it("shows the empty state when there is no call history yet", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("No calls yet.")).toBeInTheDocument();
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

    await screen.findByText("No calls yet.");
    expect(screen.queryByLabelText("Call candidate")).not.toBeInTheDocument();
  });

  it("opens a confirm dialog before triggering a call, and triggers it on confirm", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    adminCandidateAiCallsClient.triggerCandidateAiCall.mockResolvedValue(call({ status: "requested", outcome: undefined }));
    const client = await signInAs(HR);

    renderCard(client);
    await screen.findByText("No calls yet.");

    fireEvent.change(screen.getByLabelText("Call candidate"), { target: { value: "voice-2" } });

    expect(await screen.findByText("Place this call?")).toBeInTheDocument();
    expect(screen.getByText('The recorded message "Medical report received" will be played to this candidate now.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Call now" }));

    await waitFor(() =>
      expect(adminCandidateAiCallsClient.triggerCandidateAiCall).toHaveBeenCalledWith(
        "candidate-1",
        "voice-2",
        expect.any(String)
      )
    );
    await waitFor(() => expect(screen.queryByText("Place this call?")).not.toBeInTheDocument());
  });

  it("cancelling the confirm dialog does not trigger a call", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    const client = await signInAs(HR);

    renderCard(client);
    await screen.findByText("No calls yet.");

    fireEvent.change(screen.getByLabelText("Call candidate"), { target: { value: "voice-1" } });
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
    await screen.findByText("No calls yet.");

    fireEvent.change(screen.getByLabelText("Call candidate"), { target: { value: "voice-1" } });
    await screen.findByText("Place this call?");
    fireEvent.click(screen.getByRole("button", { name: "Call now" }));

    expect(await screen.findByText("This candidate has no current assignment.")).toBeInTheDocument();
  });

  it("does not sign the admin out when the selected candidate is inactive, and shows a candidate-specific message", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    adminCandidateAiCallsClient.triggerCandidateAiCall.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    const client = await signInAs(HR);
    const signOutSpy = vi.spyOn(client, "signOut");

    renderCard(client);
    await screen.findByText("No calls yet.");

    fireEvent.change(screen.getByLabelText("Call candidate"), { target: { value: "voice-1" } });
    await screen.findByText("Place this call?");
    fireEvent.click(screen.getByRole("button", { name: "Call now" }));

    expect(await screen.findByText("This candidate is inactive and cannot receive an AI call.")).toBeInTheDocument();
    expect(screen.getByText("Place this call?")).toBeInTheDocument();
    expect(signOutSpy).not.toHaveBeenCalled();
  });

  it("signs the admin out when the call history itself reports an inactive/session-expired staff account", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    const client = await signInAs(HR);
    const signOutSpy = vi.spyOn(client, "signOut");

    renderCard(client);

    await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
  });

  it("shows an actionable message and refreshes call history on an idempotency conflict, without closing the dialog", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    adminCandidateAiCallsClient.triggerCandidateAiCall.mockRejectedValue({ code: "IDEMPOTENCY_CONFLICT" });
    const client = await signInAs(HR);

    renderCard(client);
    await screen.findByText("No calls yet.");

    fireEvent.change(screen.getByLabelText("Call candidate"), { target: { value: "voice-1" } });
    await screen.findByText("Place this call?");
    fireEvent.click(screen.getByRole("button", { name: "Call now" }));

    expect(
      await screen.findByText("This request may already have gone through. Check the call history below before trying again.")
    ).toBeInTheDocument();
    expect(screen.getByText("Place this call?")).toBeInTheDocument();
    await waitFor(() => expect(adminCandidateAiCallsClient.listCandidateAiCalls).toHaveBeenCalledTimes(2));
  });

  it("renders the summary, outcome reason, answered/completed timestamps and triggered-by details", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([
      call({ summary: "Candidate confirmed they will upload the passport by Friday." }),
    ]);
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText(/Candidate confirmed they will upload the passport by Friday\./)).toBeInTheDocument();
    expect(screen.getByText("Resolved on the call")).toBeInTheDocument();
    expect(screen.getByText(/Answered:/)).toBeInTheDocument();
    expect(screen.getByText(/Completed:/)).toBeInTheDocument();
    expect(screen.getByText(/Triggered by: hr/)).toBeInTheDocument();
  });

  it("makes a callback-required outcome visually prominent, including its reason", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([
      call({ outcome: "callback_required", outcomeReason: "candidate_requested" }),
    ]);
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText(/Callback required.*Candidate requested a callback/)).toBeInTheDocument();
  });

  it("lists only the active call types in the call dropdown", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    const client = await signInAs(HR);

    renderCard(client);
    await screen.findByText("No calls yet.");

    const select = await screen.findByLabelText("Call candidate");
    await waitFor(() => expect(within(select).getByRole("option", { name: "Upload documents" })).toBeInTheDocument());
    expect(within(select).getByRole("option", { name: "Medical report received" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Old call" })).not.toBeInTheDocument();
  });

  it("tells the admin when no call type is active, instead of showing an empty dropdown", async () => {
    adminBulkCallsClient.listVoices.mockResolvedValue([VOICES[2]]);
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([]);
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("No call type is active. Add or switch one on in Bulk calls.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Call candidate")).not.toBeInTheDocument();
  });

  it("shows automatic and bulk calls in the history with what started them and the stage", async () => {
    adminCandidateAiCallsClient.listCandidateAiCalls.mockResolvedValue([
      call({ id: "call-auto", trigger: "automatic", workflowStageCode: "documents_pending", voice: { voiceId: "538", nameEn: "Upload documents" } }),
      call({ id: "call-bulk", trigger: "bulk", voice: { voiceId: "537", nameEn: "Medical report received" } }),
      call({ id: "call-gone", trigger: "manual", voice: { voiceId: "999" } }),
    ]);
    const client = await signInAs(HR);

    renderCard(client);

    const list = within(await screen.findByRole("list"));
    expect(list.getByText("Automatic (stage)")).toBeInTheDocument();
    expect(list.getByText(/Stage: Documents Pending/)).toBeInTheDocument();
    expect(list.getByText("Bulk call")).toBeInTheDocument();
    expect(list.getByText("Medical report received")).toBeInTheDocument();
    expect(list.getByText("Recorded call")).toBeInTheDocument();
  });
});
