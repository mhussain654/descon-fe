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
    announcementEn: "Hello, this is Descon Manpower calling.",
    announcementUr: undefined,
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

  it("lists scripts for an authorized staff member, showing both languages", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([
      script({ announcementUr: "السلام علیکم، یہ ڈیسکون مین پاور کی کال ہے۔" }),
    ]);
    const client = await signInAs(HR);

    renderList(client);

    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Hello, this is Descon Manpower calling.")).toBeInTheDocument();
    expect(screen.getByText("السلام علیکم، یہ ڈیسکون مین پاور کی کال ہے۔")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows a placeholder when Urdu wording hasn't been added yet", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script()]);
    const client = await signInAs(HR);

    renderList(client);

    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Urdu wording not added yet -- English is used for every candidate.")).toBeInTheDocument();
  });

  it("shows the forbidden state for a staff member without manage_ai_call_scripts", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(FINANCE);

    renderList(client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("shows the empty state when there are no scripts", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([]);
    const client = await signInAs(HR);

    renderList(client);

    expect(await screen.findByText("No call scripts yet")).toBeInTheDocument();
  });

  it("edits and saves both languages and the active flag", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script()]);
    adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript.mockResolvedValue(
      script({ announcementEn: "Approved wording.", announcementUr: "منظور شدہ۔", active: true })
    );
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText("Opening announcement (English)"), { target: { value: "Approved wording." } });
    fireEvent.change(screen.getByLabelText("Opening announcement (Urdu)"), { target: { value: "منظور شدہ۔" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).toHaveBeenCalledWith("verified", {
        announcementEn: "Approved wording.",
        announcementUr: "منظور شدہ۔",
        active: true,
      })
    );
    await waitFor(() => expect(screen.queryByLabelText("Opening announcement (English)")).not.toBeInTheDocument());
  });

  it("cancelling the edit discards changes without saving", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script()]);
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Opening announcement (English)"), { target: { value: "Changed but not saved." } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Opening announcement (English)")).not.toBeInTheDocument();
    expect(screen.getByText("Hello, this is Descon Manpower calling.")).toBeInTheDocument();
    expect(adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript).not.toHaveBeenCalled();
  });

  it("shows the server validation message and stays in edit mode on a validation failure", async () => {
    adminWorkflowStageCallScriptsClient.listWorkflowStageCallScripts.mockResolvedValue([script()]);
    adminWorkflowStageCallScriptsClient.updateWorkflowStageCallScript.mockRejectedValue({
      code: "VALIDATION_FAILED",
      message: "Announcement en can't be blank.",
    });
    const client = await signInAs(HR);

    renderList(client);
    await screen.findByText("Verified");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Opening announcement (English)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Announcement en can't be blank.")).toBeInTheDocument();
    expect(screen.getByLabelText("Opening announcement (English)")).toBeInTheDocument();
  });
});
