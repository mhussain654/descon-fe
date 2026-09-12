import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminAiCallOperationalSettingsClient } from "../../../../lib/admin-ai-call-operational-settings-client";
import { AiCallOperationalSettingsPage } from "./AiCallOperationalSettingsPage";

vi.mock("../../../../lib/admin-ai-call-operational-settings-client", () => ({
  adminAiCallOperationalSettingsClient: { getAiCallOperationalSettings: vi.fn(), updateAiCallOperationalSettings: vi.fn() },
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
          <AiCallOperationalSettingsPage />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function settings(overrides: Record<string, unknown> = {}) {
  return {
    outboundTriggerCooldownMinutes: null,
    dailyOutboundCallLimit: null,
    adminTriggerRateLimitPerHour: null,
    callingHoursStart: null,
    callingHoursEnd: null,
    maxCallDurationMinutes: null,
    updatedBy: undefined,
    updatedAt: "2026-09-11T09:00:00Z",
    ...overrides,
  };
}

describe("AiCallOperationalSettingsPage", () => {
  afterEach(() => {
    vi.mocked(adminAiCallOperationalSettingsClient.getAiCallOperationalSettings).mockReset();
    vi.mocked(adminAiCallOperationalSettingsClient.updateAiCallOperationalSettings).mockReset();
    sessionStorage.clear();
  });

  it("renders every field blank when no overrides are set", async () => {
    adminAiCallOperationalSettingsClient.getAiCallOperationalSettings.mockResolvedValue(settings());
    const client = await signInAs(ADMIN);

    renderPage(client);

    expect(await screen.findByText("AI call settings")).toBeInTheDocument();
    expect(await screen.findByLabelText("Daily outbound call limit")).toHaveValue(null);
  });

  it("renders existing overrides in their fields", async () => {
    adminAiCallOperationalSettingsClient.getAiCallOperationalSettings.mockResolvedValue(
      settings({ dailyOutboundCallLimit: 75, callingHoursStart: 8 })
    );
    const client = await signInAs(ADMIN);

    renderPage(client);

    expect(await screen.findByLabelText("Daily outbound call limit")).toHaveValue(75);
    expect(screen.getByLabelText("Calling hours start (0-23)")).toHaveValue(8);
  });

  it("shows the forbidden state for a staff member without manage_ai_call_settings", async () => {
    adminAiCallOperationalSettingsClient.getAiCallOperationalSettings.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(HR);

    renderPage(client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("saves an edited value, sending null for every untouched blank field", async () => {
    adminAiCallOperationalSettingsClient.getAiCallOperationalSettings.mockResolvedValue(settings());
    adminAiCallOperationalSettingsClient.updateAiCallOperationalSettings.mockResolvedValue(settings({ dailyOutboundCallLimit: 50 }));
    const client = await signInAs(ADMIN);

    renderPage(client);
    await screen.findByText("AI call settings");

    fireEvent.change(screen.getByLabelText("Daily outbound call limit"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminAiCallOperationalSettingsClient.updateAiCallOperationalSettings).toHaveBeenCalledWith({
        outboundTriggerCooldownMinutes: null,
        dailyOutboundCallLimit: 50,
        adminTriggerRateLimitPerHour: null,
        callingHoursStart: null,
        callingHoursEnd: null,
        maxCallDurationMinutes: null,
      })
    );
  });

  it("clearing a field back to blank sends null for it on save", async () => {
    adminAiCallOperationalSettingsClient.getAiCallOperationalSettings.mockResolvedValue(settings({ dailyOutboundCallLimit: 75 }));
    adminAiCallOperationalSettingsClient.updateAiCallOperationalSettings.mockResolvedValue(settings());
    const client = await signInAs(ADMIN);

    renderPage(client);
    await screen.findByLabelText("Daily outbound call limit");

    fireEvent.change(screen.getByLabelText("Daily outbound call limit"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminAiCallOperationalSettingsClient.updateAiCallOperationalSettings).toHaveBeenCalledWith(
        expect.objectContaining({ dailyOutboundCallLimit: null })
      )
    );
  });

  it("shows the server validation message on a validation failure", async () => {
    adminAiCallOperationalSettingsClient.getAiCallOperationalSettings.mockResolvedValue(settings());
    adminAiCallOperationalSettingsClient.updateAiCallOperationalSettings.mockRejectedValue({
      code: "VALIDATION_FAILED",
      message: "Calling hours start must be between 0 and 23.",
    });
    const client = await signInAs(ADMIN);

    renderPage(client);
    await screen.findByLabelText("Calling hours start (0-23)");

    fireEvent.change(screen.getByLabelText("Calling hours start (0-23)"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Calling hours start must be between 0 and 23.")).toBeInTheDocument();
  });
});
