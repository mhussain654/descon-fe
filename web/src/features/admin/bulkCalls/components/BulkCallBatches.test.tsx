import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminBulkCallsClient } from "../../../../lib/admin-bulk-calls-client";
import { BulkCallBatchDetail } from "./BulkCallBatchDetail";
import { BulkCallBatchList } from "./BulkCallBatchList";
import { ADMIN, batch, renderWithStaff, signInAs } from "./bulkCallTestSupport";

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

describe("BulkCallBatchList", () => {
  it("shows each recent bulk call with its progress and a link to its results", async () => {
    client.listBatches.mockResolvedValue([batch(), batch({ id: "batch-2", voice: { id: "v2", name: "Flight" }, workflowStageCode: "medical_completed", counts: { queued: 0, placed: 12, skipped: 0, failed: 0 }, createdBy: { id: "s", role: "mystery_role" } })]);
    renderWithStaff(await signInAs(ADMIN), <BulkCallBatchList />);

    expect(await screen.findByText("Visa approved")).toBeInTheDocument();
    expect(screen.getByText("40 called, 150 waiting, 7 skipped, 3 failed")).toBeInTheDocument();
    expect(screen.getByText("Flight")).toBeInTheDocument();
    expect(screen.getByText("12 called, 0 waiting, 0 skipped, 0 failed")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "View results" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/admin/bulk-calls/batch-1", "/admin/bulk-calls/batch-2"]);
    expect(screen.getByText("mystery_role")).toBeInTheDocument();
  });

  it("shows a stage this build has no name for as its code", async () => {
    client.listBatches.mockResolvedValue([batch({ workflowStageCode: "brand_new_stage" })]);
    renderWithStaff(await signInAs(ADMIN), <BulkCallBatchList />);

    expect(await screen.findByText("brand_new_stage")).toBeInTheDocument();
  });

  it("says so when no bulk call has been started", async () => {
    client.listBatches.mockResolvedValue([]);
    renderWithStaff(await signInAs(ADMIN), <BulkCallBatchList />);

    expect(await screen.findByText("No bulk call has been started yet.")).toBeInTheDocument();
  });

  it("shows the forbidden state without permission", async () => {
    client.listBatches.mockRejectedValue({ code: "FORBIDDEN" });
    renderWithStaff(await signInAs(ADMIN), <BulkCallBatchList />);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});

describe("BulkCallBatchDetail", () => {
  it("shows the counts and each candidate's result, skip reason and call outcome", async () => {
    client.getBatch.mockResolvedValue(
      batch({
        counts: { queued: 1, placed: 2, skipped: 1, failed: 1 },
        items: [
          { id: 1, candidate: { id: "c1", fullName: "Ahmed Khan", mobileNumberMasked: "+92300*****12" }, status: "placed", call: { id: "k1", status: "completed", outcome: "callback_required", outcomeReason: "candidate_requested" } },
          { id: 2, candidate: { id: "c2", fullName: "Bilal Raza", mobileNumberMasked: "+92301*****34" }, status: "placed", call: { id: "k2", status: "queued" } },
          { id: 3, candidate: { id: "c3", fullName: "Sana Malik", mobileNumberMasked: "+92302*****56" }, status: "skipped", skipReason: "stage_changed" },
          { id: 4, candidate: { id: "c4", fullName: "Omar Sheikh", mobileNumberMasked: "+92303*****78" }, status: "failed", skipReason: "provider_error" },
          { id: 5, candidate: { id: "c5", fullName: "Hina Aslam", mobileNumberMasked: "+92304*****90" }, status: "queued" },
        ],
      })
    );
    renderWithStaff(await signInAs(ADMIN), <BulkCallBatchDetail batchId="batch-1" />);

    expect(await screen.findByText("Ahmed Khan")).toBeInTheDocument();
    expect(client.getBatch).toHaveBeenCalledWith("batch-1");
    expect(screen.getByText(/Visa approved · Verified/)).toBeInTheDocument();
    expect(screen.getByText("Moved to another stage")).toBeInTheDocument();
    expect(screen.getByText("RoboCall could not take the call")).toBeInTheDocument();
    expect(screen.getByText(/Callback required/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to bulk calls" })).toHaveAttribute("href", "/admin/bulk-calls");
    expect(screen.getByText("Skipped or failed candidates can be called again in a later batch.")).toBeInTheDocument();
  });

  it("says so when the batch has no candidates", async () => {
    client.getBatch.mockResolvedValue(batch({ items: [] }));
    renderWithStaff(await signInAs(ADMIN), <BulkCallBatchDetail batchId="batch-1" />);

    expect(await screen.findByText("No candidates match this selection.")).toBeInTheDocument();
  });

  it("shows an error when the batch cannot be found", async () => {
    client.getBatch.mockRejectedValue({ code: "NOT_FOUND" });
    renderWithStaff(await signInAs(ADMIN), <BulkCallBatchDetail batchId="missing" />);

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
