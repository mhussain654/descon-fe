import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminBulkCallsClient } from "../../../../lib/admin-bulk-calls-client";
import { BulkCallPlanner } from "./BulkCallPlanner";
import { ADMIN, batch, candidatesResult, renderWithStaff, signInAs, voice } from "./bulkCallTestSupport";

vi.mock("../../../../lib/admin-bulk-calls-client", () => ({
  adminBulkCallsClient: {
    listVoices: vi.fn(),
    createVoice: vi.fn(),
    updateVoice: vi.fn(),
    listCandidates: vi.fn(),
    startBatch: vi.fn(),
    listBatches: vi.fn(),
    getBatch: vi.fn(),
  },
}));

const client = vi.mocked(adminBulkCallsClient);

afterEach(() => {
  Object.values(client).forEach((fn) => fn.mockReset());
  sessionStorage.clear();
});

async function renderPlanner() {
  client.listVoices.mockResolvedValue([voice(), voice({ id: "voice-2", nameEn: "Flight", voiceId: "300", active: false })]);
  renderWithStaff(await signInAs(ADMIN), <BulkCallPlanner />);
  await screen.findByRole("option", { name: "Visa approved" });
}

async function choose(stage = "verified", voiceId = "voice-1") {
  fireEvent.change(screen.getByLabelText("Workflow stage"), { target: { value: stage } });
  fireEvent.change(screen.getByLabelText("Call type"), { target: { value: voiceId } });
}

describe("BulkCallPlanner", () => {
  it("asks for a stage and a call type before showing anyone, and offers only active call types", async () => {
    await renderPlanner();

    expect(screen.getByText("Choose a workflow stage and a call type to see the candidates.")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Flight" })).not.toBeInTheDocument();
    expect(client.listCandidates).not.toHaveBeenCalled();
  });

  it("lists the stage's candidates with their call state, the totals, and a button for the next batch", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult());
    await renderPlanner();

    await choose();

    expect(await screen.findByText("Ahmed Khan")).toBeInTheDocument();
    expect(client.listCandidates).toHaveBeenCalledWith({
      voiceId: "voice-1",
      stageCode: "verified",
      called: "not_called",
      search: undefined,
      page: 1,
      pageSize: 25,
    });
    expect(screen.getByText("Bilal Raza")).toBeInTheDocument();
    expect(screen.getByText("Not called")).toBeInTheDocument();
    expect(screen.getByText(/Answered/)).toBeInTheDocument();
    expect(screen.getByText("340")).toBeInTheDocument();
    expect(screen.getByText("Next batch: 200 candidates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Call next 200" })).toBeEnabled();
  });

  it("caps the batch at the limit when more are left, and says the rest can follow in another batch", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult({ summary: { matching: 500, called: 0, remaining: 500 }, batchLimit: 200 }));
    await renderPlanner();

    await choose();

    expect(await screen.findByRole("button", { name: "Call next 200" })).toBeInTheDocument();
    expect(screen.getByText(/500 are still to be called\. This batch covers the first 200/)).toBeInTheDocument();
  });

  it("offers fewer than the limit when fewer are left, with no extra hint", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult({ summary: { matching: 340, called: 290, remaining: 50 }, batchLimit: 200 }));
    await renderPlanner();

    await choose();

    expect(await screen.findByRole("button", { name: "Call next 50" })).toBeInTheDocument();
    expect(screen.queryByText(/are still to be called/)).not.toBeInTheDocument();
  });

  it("starts the batch only after confirming, then shows where to follow it", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult());
    client.startBatch.mockResolvedValue(batch());
    await renderPlanner();
    await choose();

    fireEvent.click(await screen.findByRole("button", { name: "Call next 200" }));

    expect(await screen.findByText("Start this bulk call?")).toBeInTheDocument();
    expect(screen.getByText(/Each of the 200 candidates at "Verified" will receive the "Visa approved" call/)).toBeInTheDocument();
    expect(client.startBatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Start calling" }));

    await waitFor(() =>
      expect(client.startBatch).toHaveBeenCalledWith({
        voiceId: "voice-1",
        stageCode: "verified",
        limit: 200,
        search: undefined,
        idempotencyKey: expect.stringMatching(/^admin-bulk-call-/),
      })
    );
    expect(await screen.findByText("Bulk call started")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View results" })).toHaveAttribute("href", "/admin/bulk-calls/batch-1");
    // The list was refreshed, so who is left to call is up to date.
    await waitFor(() => expect(client.listCandidates.mock.calls.length).toBeGreaterThan(1));
  });

  it("keeps the dialog open and shows the server's message when the batch is refused", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult());
    client.startBatch.mockRejectedValue({ code: "OUTSIDE_CALLING_HOURS", message: "AI calls can only be placed during allowed calling hours." });
    await renderPlanner();
    await choose();

    fireEvent.click(await screen.findByRole("button", { name: "Call next 200" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start calling" }));

    expect(await screen.findByText("AI calls can only be placed during allowed calling hours.")).toBeInTheDocument();
    expect(screen.getByText("Start this bulk call?")).toBeInTheDocument();
    expect(screen.queryByText("Bulk call started")).not.toBeInTheDocument();
  });

  it("falls back to the translated explanation when the server sends no message", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult());
    client.startBatch.mockRejectedValue({ code: "DAILY_LIMIT_REACHED" });
    await renderPlanner();
    await choose();

    fireEvent.click(await screen.findByRole("button", { name: "Call next 200" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start calling" }));

    expect(await screen.findByText("This batch is bigger than what is left of today's call limit.")).toBeInTheDocument();
  });

  it("clears the error when the dialog is closed", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult());
    client.startBatch.mockRejectedValue({ code: "NOTHING_TO_CALL", message: "Nobody left." });
    await renderPlanner();
    await choose();
    fireEvent.click(await screen.findByRole("button", { name: "Call next 200" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start calling" }));
    await screen.findByText("Nobody left.");

    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" }).at(-1)!);
    await waitFor(() => expect(screen.queryByText("Start this bulk call?")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Call next 200" }));

    expect(await screen.findByText("Start this bulk call?")).toBeInTheDocument();
    expect(screen.queryByText("Nobody left.")).not.toBeInTheDocument();
  });

  it("says no one is left, with no start button, once everyone has been called", async () => {
    client.listCandidates.mockResolvedValue(
      candidatesResult({ candidates: [], summary: { matching: 40, called: 40, remaining: 0 }, pagination: { page: 1, perPage: 25, totalCount: 0, totalPages: 0 } })
    );
    await renderPlanner();

    await choose();

    expect(await screen.findByText("No one is left to call here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Call next/ })).not.toBeInTheDocument();
    expect(screen.getByText("Everyone at this stage has been called, or no one is at it.")).toBeInTheDocument();
  });

  it("asks for the list again, with the right filter, when 'Show' changes", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult());
    await renderPlanner();
    await choose();
    await screen.findByText("Ahmed Khan");

    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "called" } });

    await waitFor(() => expect(client.listCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ called: "called", page: 1 })));
  });

  it("sends the search once typing settles, and starts again from page 1", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult());
    await renderPlanner();
    await choose();
    await screen.findByText("Ahmed Khan");

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: " khan " } });

    await waitFor(() => expect(client.listCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ search: "khan", page: 1 })));
  });

  it("pages through a long list", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult({ pagination: { page: 1, perPage: 25, totalCount: 60, totalPages: 3 } }));
    await renderPlanner();
    await choose();
    await screen.findByText("Ahmed Khan");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => expect(client.listCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it("starts from the first page again after the selection changes", async () => {
    client.listCandidates.mockResolvedValue(candidatesResult({ pagination: { page: 2, perPage: 25, totalCount: 60, totalPages: 3 } }));
    await renderPlanner();
    await choose();
    await screen.findByText("Ahmed Khan");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(client.listCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })));

    fireEvent.change(screen.getByLabelText("Workflow stage"), { target: { value: "fee_paid" } });

    await waitFor(() => expect(client.listCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ stageCode: "fee_paid", page: 1 })));
  });

  it("explains how to continue when there is no call type yet", async () => {
    client.listVoices.mockResolvedValue([]);
    renderWithStaff(await signInAs(ADMIN), <BulkCallPlanner />);

    expect(await screen.findByText("There is no call type yet. Add one below, then come back here.")).toBeInTheDocument();
  });

  it("shows the forbidden state for staff without permission", async () => {
    client.listVoices.mockResolvedValue([voice()]);
    client.listCandidates.mockRejectedValue({ code: "FORBIDDEN" });
    renderWithStaff(await signInAs(ADMIN), <BulkCallPlanner />);
    await screen.findByRole("option", { name: "Visa approved" });

    await choose();

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("offers a retry when the list cannot be loaded", async () => {
    client.listCandidates.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValue(candidatesResult());
    await renderPlanner();
    await choose();

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Ahmed Khan")).toBeInTheDocument();
  });
});
