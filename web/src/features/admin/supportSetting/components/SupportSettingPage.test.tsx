import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminSupportSettingClient } from "../../../../lib/admin-support-setting-client";
import { SupportSettingPage } from "./SupportSettingPage";

vi.mock("../../../../lib/admin-support-setting-client", () => ({
  adminSupportSettingClient: { getSupportSetting: vi.fn(), updateSupportSetting: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin")!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr" && !account.locked && !account.suspended)!;

async function signInAs(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function renderPage(client: Awaited<ReturnType<typeof signInAs>>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <SupportSettingPage />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function setting(overrides: Record<string, unknown> = {}) {
  return {
    phoneNumber: "+923001234567",
    updatedBy: undefined,
    updatedAt: "2026-09-12T09:00:00Z",
    ...overrides,
  };
}

describe("SupportSettingPage", () => {
  afterEach(() => {
    vi.mocked(adminSupportSettingClient.getSupportSetting).mockReset();
    vi.mocked(adminSupportSettingClient.updateSupportSetting).mockReset();
    sessionStorage.clear();
  });

  it("renders the current support number", async () => {
    adminSupportSettingClient.getSupportSetting.mockResolvedValue(setting());
    const client = await signInAs(ADMIN);

    renderPage(client);

    expect(await screen.findByText("Help & support")).toBeInTheDocument();
    expect(await screen.findByLabelText(/Support phone number/)).toHaveValue("+923001234567");
  });

  it("shows the forbidden state for a staff member without manage_support_settings", async () => {
    adminSupportSettingClient.getSupportSetting.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(HR);

    renderPage(client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("saves an edited number", async () => {
    adminSupportSettingClient.getSupportSetting.mockResolvedValue(setting());
    adminSupportSettingClient.updateSupportSetting.mockResolvedValue(setting({ phoneNumber: "+923007654321" }));
    const client = await signInAs(ADMIN);

    renderPage(client);
    await screen.findByLabelText(/Support phone number/);

    fireEvent.change(screen.getByLabelText(/Support phone number/), { target: { value: "+92 300 7654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminSupportSettingClient.updateSupportSetting).toHaveBeenCalledWith({ phoneNumber: "+92 300 7654321" })
    );
  });

  it("shows the server validation message on a validation failure", async () => {
    adminSupportSettingClient.getSupportSetting.mockResolvedValue(setting());
    adminSupportSettingClient.updateSupportSetting.mockRejectedValue({
      code: "VALIDATION_FAILED",
      message: "Phone number is invalid",
    });
    const client = await signInAs(ADMIN);

    renderPage(client);
    await screen.findByLabelText(/Support phone number/);

    fireEvent.change(screen.getByLabelText(/Support phone number/), { target: { value: "call us" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Phone number is invalid")).toBeInTheDocument();
  });

  it("starts with an empty field when no number has been set yet", async () => {
    adminSupportSettingClient.getSupportSetting.mockResolvedValue(setting({ phoneNumber: null }));
    const client = await signInAs(ADMIN);

    renderPage(client);

    expect(await screen.findByLabelText(/Support phone number/)).toHaveValue("");
  });
});
