import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminAppSettingsClient } from "../../../../lib/admin-app-settings-client";
import type { SmsTemplate } from "../../../../lib/admin-app-settings-client";
import { SmsTemplateList } from "./SmsTemplateList";

vi.mock("../../../../lib/admin-app-settings-client", () => ({
  adminAppSettingsClient: { listSmsTemplates: vi.fn(), updateSmsTemplate: vi.fn() },
}));

const DEVELOPER = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "developer")!;

async function renderList() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: DEVELOPER.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <SmsTemplateList />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function template(overrides: Partial<SmsTemplate> = {}): SmsTemplate {
  return {
    messageCode: "fee_pending",
    templateIdEn: "20010",
    templateIdUr: null,
    enabled: true,
    canDisable: true,
    variables: ["name", "amount"],
    updatedBy: undefined,
    updatedAt: "2026-10-30T09:00:00Z",
    ...overrides,
  };
}

const OTP = template({ messageCode: "otp", templateIdEn: "10790", canDisable: false, variables: ["code", "minutes"] });

function card(heading: string) {
  return screen.getByRole("heading", { name: heading }).closest("div.h-full") as HTMLElement;
}

describe("SmsTemplateList", () => {
  afterEach(() => {
    vi.mocked(adminAppSettingsClient.listSmsTemplates).mockReset();
    vi.mocked(adminAppSettingsClient.updateSmsTemplate).mockReset();
    sessionStorage.clear();
  });

  it("shows each message with its template ids, status and the values its template must use", async () => {
    vi.mocked(adminAppSettingsClient.listSmsTemplates).mockResolvedValue([
      OTP,
      template(),
      template({ messageCode: "visa_issued", templateIdEn: null, variables: ["name"] }),
      template({ messageCode: "visa_rejected", enabled: false, variables: ["name"] }),
    ]);

    await renderList();

    await screen.findByRole("heading", { name: "Please pay the fee" });
    const fee = card("Please pay the fee");
    expect(within(fee).getByText("20010")).toBeInTheDocument();
    expect(within(fee).getByText("Not set")).toBeInTheDocument();
    expect(within(fee).getByText("#amount#")).toBeInTheDocument();
    expect(within(fee).getByText("On")).toBeInTheDocument();
    expect(within(card("Login code (OTP)")).getByText("#code#")).toBeInTheDocument();
    expect(within(card("Visa issued")).getByText("No template: not sent")).toBeInTheDocument();
    expect(within(card("Visa not approved")).getByText("Off")).toBeInTheDocument();
  });

  it("saves new template ids and the switch for a message", async () => {
    vi.mocked(adminAppSettingsClient.listSmsTemplates).mockResolvedValue([template()]);
    vi.mocked(adminAppSettingsClient.updateSmsTemplate).mockResolvedValue(template());

    await renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Edit: Please pay the fee" }));
    fireEvent.change(screen.getByLabelText("English template id"), { target: { value: "20020" } });
    fireEvent.change(screen.getByLabelText("Urdu template id"), { target: { value: "20021" } });
    fireEvent.change(screen.getByLabelText("Send this SMS"), { target: { value: "off" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminAppSettingsClient.updateSmsTemplate).toHaveBeenCalledWith("fee_pending", {
        templateIdEn: "20020",
        templateIdUr: "20021",
        enabled: false,
      })
    );
    expect(await screen.findByRole("button", { name: "Edit: Please pay the fee" })).toBeInTheDocument();
  });

  it("never offers to switch off the OTP and never sends a switch for it", async () => {
    vi.mocked(adminAppSettingsClient.listSmsTemplates).mockResolvedValue([OTP]);
    vi.mocked(adminAppSettingsClient.updateSmsTemplate).mockResolvedValue(OTP);

    await renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Edit: Login code (OTP)" }));

    expect(screen.queryByLabelText("Send this SMS")).not.toBeInTheDocument();
    expect(screen.getByText(/Always on: candidates need it to log in/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(adminAppSettingsClient.updateSmsTemplate).toHaveBeenCalledWith("otp", { templateIdEn: "10790", templateIdUr: "" })
    );
  });

  it("shows the server's message when a template id is rejected, and stays in edit mode", async () => {
    vi.mocked(adminAppSettingsClient.listSmsTemplates).mockResolvedValue([template()]);
    vi.mocked(adminAppSettingsClient.updateSmsTemplate).mockRejectedValue({ code: "VALIDATION_FAILED", message: "Template id is invalid" });

    await renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Edit: Please pay the fee" }));
    fireEvent.change(screen.getByLabelText("English template id"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Template id is invalid")).toBeInTheDocument();
    expect(screen.getByLabelText("English template id")).toHaveValue("abc");
  });

  it("goes back to the saved values on cancel", async () => {
    vi.mocked(adminAppSettingsClient.listSmsTemplates).mockResolvedValue([template()]);

    await renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Edit: Please pay the fee" }));
    fireEvent.change(screen.getByLabelText("English template id"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("20010")).toBeInTheDocument();
    expect(adminAppSettingsClient.updateSmsTemplate).not.toHaveBeenCalled();
  });

  it("shows the empty state when there are no rows, and the forbidden state for a non-developer", async () => {
    vi.mocked(adminAppSettingsClient.listSmsTemplates).mockResolvedValueOnce([]);
    const { unmount } = await renderList();
    expect(await screen.findByText("No SMS messages yet")).toBeInTheDocument();
    unmount();

    vi.mocked(adminAppSettingsClient.listSmsTemplates).mockRejectedValueOnce({ code: "FORBIDDEN" });
    await renderList();
    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});
