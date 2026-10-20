import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminBulkCallsClient } from "../../../../lib/admin-bulk-calls-client";
import { CallTypesCard } from "./CallTypesCard";
import { ADMIN, FINANCE, MANAGE_CALL_TYPES, renderWithStaff, signInAs, voice } from "./bulkCallTestSupport";

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

describe("CallTypesCard", () => {
  it("lists each call type with its voice id and whether it is active", async () => {
    client.listVoices.mockResolvedValue([voice({ nameUr: "ویزا منظور" }), voice({ id: "voice-2", nameEn: "Flight", voiceId: "300", active: false })]);
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);

    expect(await screen.findByText("Visa approved")).toBeInTheDocument();
    expect(screen.getByText("ویزا منظور")).toBeInTheDocument();
    expect(screen.getByText("205")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("shows an empty message when there are no call types", async () => {
    client.listVoices.mockResolvedValue([]);
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);

    expect(await screen.findByText("No call types yet.")).toBeInTheDocument();
  });

  it("adds a call type", async () => {
    client.listVoices.mockResolvedValue([]);
    client.createVoice.mockResolvedValue(voice());
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Add call type" }));

    fireEvent.change(screen.getByLabelText(/^Name$/), { target: { value: "Visa approved" } });
    fireEvent.change(screen.getByLabelText(/Name \(Urdu\)/), { target: { value: "ویزا منظور" } });
    fireEvent.change(screen.getByLabelText(/Voice ID/), { target: { value: "205" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(client.createVoice).toHaveBeenCalledWith({ nameEn: "Visa approved", nameUr: "ویزا منظور", voiceId: "205", active: true }));
    await waitFor(() => expect(screen.queryByLabelText(/Voice ID/)).not.toBeInTheDocument());
  });

  it("shows the server's message under the voice id when it is rejected, and keeps the form", async () => {
    client.listVoices.mockResolvedValue([]);
    client.createVoice.mockRejectedValue({ code: "VALIDATION_FAILED", message: "Voice has already been taken" });
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Add call type" }));
    fireEvent.change(screen.getByLabelText(/^Name$/), { target: { value: "Dup" } });
    fireEvent.change(screen.getByLabelText(/Voice ID/), { target: { value: "205" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Voice has already been taken")).toBeInTheDocument();
    expect(screen.getByLabelText(/Voice ID/)).toBeInTheDocument();
  });

  it("falls back to a translated message when the server gave none", async () => {
    client.listVoices.mockResolvedValue([]);
    client.createVoice.mockRejectedValue({ code: "NETWORK_ERROR" });
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Add call type" }));
    fireEvent.change(screen.getByLabelText(/^Name$/), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText(/Voice ID/), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Couldn't reach the server. Check your connection and try again.")).toBeInTheDocument();
  });

  it("cancels adding without saving", async () => {
    client.listVoices.mockResolvedValue([]);
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Add call type" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText(/Voice ID/)).not.toBeInTheDocument();
    expect(client.createVoice).not.toHaveBeenCalled();
  });

  it("edits an existing call type, keeping it active", async () => {
    client.listVoices.mockResolvedValue([voice()]);
    client.updateVoice.mockResolvedValue(voice({ nameEn: "Visa result" }));
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText(/^Name$/), { target: { value: "Visa result" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(client.updateVoice).toHaveBeenCalledWith("voice-1", { nameEn: "Visa result", nameUr: "", voiceId: "205", active: true })
    );
  });

  it("switches a call type off and on again", async () => {
    client.listVoices.mockResolvedValue([voice(), voice({ id: "voice-2", nameEn: "Flight", voiceId: "300", active: false })]);
    client.updateVoice.mockResolvedValue(voice());
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);
    await screen.findByText("Visa approved");

    fireEvent.click(screen.getByRole("button", { name: "Switch off" }));
    await waitFor(() => expect(client.updateVoice).toHaveBeenCalledWith("voice-1", { active: false }));

    fireEvent.click(screen.getByRole("button", { name: "Switch on" }));
    await waitFor(() => expect(client.updateVoice).toHaveBeenCalledWith("voice-2", { active: true }));
  });

  it("lets staff without manage permission read the list but not change it", async () => {
    client.listVoices.mockResolvedValue([voice()]);
    renderWithStaff(await signInAs(FINANCE), <CallTypesCard />);

    const row = (await screen.findByText("Visa approved")).closest("li")!;

    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add call type" })).not.toBeInTheDocument();
  });

  it("shows an error with a retry when the list cannot be loaded", async () => {
    client.listVoices.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValue([voice()]);
    renderWithStaff(await signInAs(ADMIN, MANAGE_CALL_TYPES), <CallTypesCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Visa approved")).toBeInTheDocument();
  });
});
