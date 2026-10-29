import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminAppSettingsClient } from "../../../../lib/admin-app-settings-client";
import { AppFeatureSettingsForm } from "./AppFeatureSettingsForm";

vi.mock("../../../../lib/admin-app-settings-client", () => ({
  adminAppSettingsClient: { getAppSettings: vi.fn(), updateAppSettings: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin")!;

async function signInAs(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

async function renderForm() {
  const client = await signInAs(ADMIN);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <AppFeatureSettingsForm />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function settings(overrides: Record<string, unknown> = {}) {
  const allOn = { cardPayment: true, voucherPayment: true, progressSms: true, automaticCalls: true, bulkCalls: true, documentOcr: true };
  return {
    enabled: allOn,
    serverReady: { ...allOn, documentOcr: false },
    smsMessages: [
      { code: "registered", enabled: true, templateReady: true },
      { code: "fee_pending", enabled: false, templateReady: false },
    ],
    updatedBy: undefined,
    updatedAt: "2026-10-29T09:00:00Z",
    ...overrides,
  };
}

describe("AppFeatureSettingsForm", () => {
  afterEach(() => {
    vi.mocked(adminAppSettingsClient.getAppSettings).mockReset();
    vi.mocked(adminAppSettingsClient.updateAppSettings).mockReset();
    sessionStorage.clear();
  });

  it("shows each switch, and why a switch that is on may still do nothing", async () => {
    vi.mocked(adminAppSettingsClient.getAppSettings).mockResolvedValue(settings());

    await renderForm();

    expect(await screen.findByRole("switch", { name: "Payment code" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Please pay the fee" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Not set up on the server, so it stays off")).toBeInTheDocument();
    expect(screen.getByText("SMS template not set up yet")).toBeInTheDocument();
  });

  it("saves the switches changed, with the SMS messages switched off", async () => {
    vi.mocked(adminAppSettingsClient.getAppSettings).mockResolvedValue(settings());
    vi.mocked(adminAppSettingsClient.updateAppSettings).mockResolvedValue(settings());

    await renderForm();
    fireEvent.click(await screen.findByRole("switch", { name: "Payment code" }));
    fireEvent.click(screen.getByRole("switch", { name: "Please pay the fee" }));
    fireEvent.click(screen.getByRole("switch", { name: "Registered: download the app and upload documents" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminAppSettingsClient.updateAppSettings).toHaveBeenCalledWith({
        enabled: expect.objectContaining({ voucherPayment: false, cardPayment: true }),
        disabledSmsMessages: ["registered"],
      })
    );
  });

  it("disables the single SMS messages while progress SMS are off", async () => {
    vi.mocked(adminAppSettingsClient.getAppSettings).mockResolvedValue(settings());

    await renderForm();
    fireEvent.click(await screen.findByRole("switch", { name: "Progress SMS" }));

    expect(screen.getByRole("switch", { name: "Registered: download the app and upload documents" })).toBeDisabled();
  });

  it("shows the forbidden state for a staff member without manage_app_settings", async () => {
    vi.mocked(adminAppSettingsClient.getAppSettings).mockRejectedValue({ code: "FORBIDDEN" });

    await renderForm();

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});
