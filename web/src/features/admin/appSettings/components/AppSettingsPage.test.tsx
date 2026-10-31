import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { AppSettingsPage } from "./AppSettingsPage";

vi.mock("./AppFeatureSettingsForm", () => ({ AppFeatureSettingsForm: () => <p>feature switches</p> }));
vi.mock("./SmsTemplateList", () => ({ SmsTemplateList: () => <p>sms templates list</p> }));
vi.mock("../../payments/components/FeeSettingsCard", () => ({ FeeSettingsCard: () => <p>fee card</p> }));
vi.mock("../../supportSetting/components/SupportSettingForm", () => ({ SupportSettingForm: () => <p>support form</p> }));
vi.mock("../../aiCallOperationalSettings/components/AiCallOperationalSettingsForm", () => ({
  AiCallOperationalSettingsForm: () => <p>call limits form</p>,
}));
vi.mock("../../bulkCalls/components/CallTypesCard", () => ({ CallTypesCard: () => <p>call types card</p> }));
vi.mock("../../workflowStageCallScripts/components/WorkflowStageCallScriptList", () => ({
  WorkflowStageCallScriptList: () => <p>automatic calls list</p>,
}));

async function renderAs(role: string, path = "/admin/settings") {
  const account = MOCK_STAFF_ACCOUNTS.find((candidate) => candidate.role === role && !candidate.locked && !candidate.suspended)!;
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <AppSettingsPage />
          </MemoryRouter>
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("AppSettingsPage", () => {
  afterEach(() => sessionStorage.clear());

  it("gives the developer a tab per settings area, opening on the feature switches", async () => {
    await renderAs("developer");

    expect(await screen.findByRole("tab", { name: "Features" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Support number" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Automated call limits" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bulk call settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Automatic call settings" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "SMS settings" })).toBeInTheDocument();
    expect(screen.getByText("feature switches")).toBeInTheDocument();
  });

  it("does not show an admin the developer-only Features and call limits tabs", async () => {
    await renderAs("admin");

    expect(await screen.findByRole("tab", { name: "Support number" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Features" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Automated call limits" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Bulk call settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Automatic call settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "SMS settings" })).not.toBeInTheDocument();
    expect(screen.queryByText("feature switches")).not.toBeInTheDocument();
  });

  it("opens the tab named in the link", async () => {
    await renderAs("admin", "/admin/settings?tab=support");

    expect(await screen.findByText("support form")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Support number" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the SMS settings tab from its link", async () => {
    await renderAs("developer", "/admin/settings?tab=sms");

    expect(await screen.findByText("sms templates list")).toBeInTheDocument();
  });

  it("opens the automatic calls tab from the old Automatic calls link", async () => {
    await renderAs("developer", "/admin/settings?tab=automatic-calls");

    expect(await screen.findByText("automatic calls list")).toBeInTheDocument();
  });

  it("shows finance only the fee tab", async () => {
    await renderAs("finance");

    expect(await screen.findByText("fee card")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("shows the forbidden state to staff with no settings permission", async () => {
    await renderAs("hr");

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
