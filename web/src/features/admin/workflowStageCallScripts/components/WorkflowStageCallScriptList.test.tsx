import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminWorkflowStageCallScriptsClient } from "../../../../lib/admin-workflow-stage-call-scripts-client";
import { WorkflowStageCallScriptList } from "./WorkflowStageCallScriptList";

vi.mock("../../../../lib/admin-workflow-stage-call-scripts-client", () => ({
  adminWorkflowStageCallScriptsClient: { listWorkflowStageCallScripts: vi.fn(), updateWorkflowStageCallScript: vi.fn() },
}));

const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr" && !account.locked && !account.suspended)!;
const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "finance")!;

async function signInAs(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function renderList(client: Awaited<ReturnType<typeof signInAs>>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <WorkflowStageCallScriptList />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function script(overrides: Record<string, unknown> = {}) {
  return {
    workflowStageCode: "verified" as const,
    voiceId: undefined,
    active: false,
    updatedBy: undefined,
    updatedAt: "2026-09-11T09:00:00Z",
    ...overrides,
  };
}

describe("WorkflowStageCallScriptList", () => {
  afterEach(() => {
    vi.mocked(adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts).mockReset();
    vi.mocked(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).mockReset();
    sessionStorage.clear();
  });

  it("shows stages that are calling first, then stages with a voice but switched off, then the rest", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([
      script({ workflowStageCode: "registered" }),
      script({ workflowStageCode: "documents_pending", voiceId: "538" }),
      script({ workflowStageCode: "medical_completed", voiceId: "537", active: true }),
      script({ workflowStageCode: "verified", voiceId: "102", active: true }),
    ]);
    const client = await signInAs(HR);

    renderList(client);

    await screen.findByText("Verified");
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Verified", "Medical completed", "Documents Pending", "Registered"]);
  });

  it("lists each stage's voice for an authorized staff member", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script({ voiceId: "102" })]);
    const client = await signInAs(HR);

    renderList(client);

    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("102")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("Stages with a voice")).toBeInTheDocument();
  });

  it("says no call is placed when a stage has no voice yet", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script()]);
    const client = await signInAs(HR);

    renderList(client);

    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("No voice set -- no call is placed for this stage.")).toBeInTheDocument();
  });

  it("shows the forbidden state for a staff member without manage_ai_call_scripts", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(FINANCE);

    renderList(client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("shows the empty state when there are no automatic calls", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([]);
    const client = await signInAs(HR);

    renderList(client);

    expect(await screen.findByText("No automatic calls yet")).toBeInTheDocument();
  });

  it("requires confirmation before activating a call, and saves only after confirming", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script()]);
    adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript.mockResolvedValue(
      script({ voiceId: "102", active: true })
    );
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText("Voice ID"), { target: { value: "102" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Activate this automated call?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "From now on, every candidate who enters this workflow stage will automatically receive a billed voice call playing this voice."
      )
    ).toBeInTheDocument();
    expect(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));

    await waitFor(() =>
      expect(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).toHaveBeenCalledWith("verified", {
        voiceId: "102",
        active: true,
      })
    );
    await waitFor(() => expect(screen.queryByLabelText("Voice ID")).not.toBeInTheDocument());
  });

  it("cancelling the activation confirmation does not save", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script()]);
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Activate this automated call?");

    // Two "Cancel" buttons are present once the confirm dialog opens (the
    // edit form's own Cancel, still in the DOM behind it, and the dialog's) --
    // the dialog's is the one that should actually appear once opened.
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" }).at(-1)!);

    await waitFor(() => expect(screen.queryByText("Activate this automated call?")).not.toBeInTheDocument());
    expect(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Voice ID")).toBeInTheDocument();
  });

  it("saves immediately, without confirmation, when only deactivating a call", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script({ voiceId: "102", active: true })]);
    adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript.mockResolvedValue(script({ voiceId: "102", active: false }));
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "inactive" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).toHaveBeenCalled());
    expect(screen.queryByText("Activate this automated call?")).not.toBeInTheDocument();
  });

  it("requires confirmation before changing the voice of an already-active call", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script({ voiceId: "102", active: true })]);
    adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript.mockResolvedValue(
      script({ active: true, voiceId: "205" })
    );
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Voice ID"), { target: { value: "205" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Change the voice of this active call?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));

    await waitFor(() =>
      expect(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).toHaveBeenCalledWith("verified", {
        voiceId: "205",
        active: true,
      })
    );
  });

  it("cancelling the edit discards changes without saving", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script({ voiceId: "102" })]);
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Voice ID"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Voice ID")).not.toBeInTheDocument();
    expect(screen.getByText("102")).toBeInTheDocument();
    expect(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).not.toHaveBeenCalled();
  });

  it("shows the server validation message and stays in edit mode on a validation failure", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script()]);
    adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript.mockRejectedValue({
      code: "VALIDATION_FAILED",
      message: "Voice is invalid.",
    });
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Voice ID"), { target: { value: "bad id!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Voice is invalid.")).toBeInTheDocument();
    expect(screen.getByLabelText("Voice ID")).toBeInTheDocument();
  });
});
