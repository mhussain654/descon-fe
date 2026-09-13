import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminTrainingSettingClient } from "../../../../lib/admin-training-setting-client";
import { TrainingSettingPage } from "./TrainingSettingPage";

vi.mock("../../../../lib/admin-training-setting-client", () => ({
  adminTrainingSettingClient: { getTrainingSetting: vi.fn(), updateTrainingSetting: vi.fn() },
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
          <TrainingSettingPage />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function setting(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://www.youtube.com/@DesconManpower",
    updatedBy: undefined,
    updatedAt: "2026-09-12T09:00:00Z",
    ...overrides,
  };
}

describe("TrainingSettingPage", () => {
  afterEach(() => {
    vi.mocked(adminTrainingSettingClient.getTrainingSetting).mockReset();
    vi.mocked(adminTrainingSettingClient.updateTrainingSetting).mockReset();
    sessionStorage.clear();
  });

  it("renders the current training link", async () => {
    adminTrainingSettingClient.getTrainingSetting.mockResolvedValue(setting());
    const client = await signInAs(ADMIN);

    renderPage(client);

    expect(await screen.findByText("Training")).toBeInTheDocument();
    expect(await screen.findByLabelText("Training link")).toHaveValue("https://www.youtube.com/@DesconManpower");
  });

  it("shows the forbidden state for a staff member without manage_training_settings", async () => {
    adminTrainingSettingClient.getTrainingSetting.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(HR);

    renderPage(client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("saves an edited link", async () => {
    adminTrainingSettingClient.getTrainingSetting.mockResolvedValue(setting());
    adminTrainingSettingClient.updateTrainingSetting.mockResolvedValue(setting({ url: "https://example.test/updated" }));
    const client = await signInAs(ADMIN);

    renderPage(client);
    await screen.findByLabelText("Training link");

    fireEvent.change(screen.getByLabelText("Training link"), { target: { value: "https://example.test/updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminTrainingSettingClient.updateTrainingSetting).toHaveBeenCalledWith({ url: "https://example.test/updated" })
    );
  });

  it("shows the server validation message on a validation failure", async () => {
    adminTrainingSettingClient.getTrainingSetting.mockResolvedValue(setting());
    adminTrainingSettingClient.updateTrainingSetting.mockRejectedValue({
      code: "VALIDATION_FAILED",
      message: "Url is not a valid http(s) URL.",
    });
    const client = await signInAs(ADMIN);

    renderPage(client);
    await screen.findByLabelText("Training link");

    fireEvent.change(screen.getByLabelText("Training link"), { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Url is not a valid http(s) URL.")).toBeInTheDocument();
  });
});
