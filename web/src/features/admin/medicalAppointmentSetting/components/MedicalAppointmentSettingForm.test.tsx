import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminMedicalAppointmentSettingClient } from "../../../../lib/admin-medical-appointment-setting-client";
import { MedicalAppointmentSettingForm } from "./MedicalAppointmentSettingForm";

vi.mock("../../../../lib/admin-medical-appointment-setting-client", () => ({
  adminMedicalAppointmentSettingClient: { getMedicalAppointmentSetting: vi.fn(), updateMedicalAppointmentSetting: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin")!;
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr" && !account.locked && !account.suspended)!;

async function signInAs(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function renderForm(client: Awaited<ReturnType<typeof signInAs>>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <MedicalAppointmentSettingForm />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function setting(overrides: Record<string, unknown> = {}) {
  return {
    centerName: "Al Shifa Medical Centre",
    centerAddress: "12 Mall Road, Lahore",
    appointmentOn: "2026-11-20",
    appointmentTime: "09:30",
    updatedBy: undefined,
    updatedAt: "2026-11-13T09:00:00Z",
    ...overrides,
  };
}

const getSetting = vi.mocked(adminMedicalAppointmentSettingClient.getMedicalAppointmentSetting);
const updateSetting = vi.mocked(adminMedicalAppointmentSettingClient.updateMedicalAppointmentSetting);

describe("MedicalAppointmentSettingForm", () => {
  afterEach(() => {
    getSetting.mockReset();
    updateSetting.mockReset();
    sessionStorage.clear();
  });

  it("shows the current default centre, address, date and time", async () => {
    getSetting.mockResolvedValue(setting());
    renderForm(await signInAs(ADMIN));

    expect(await screen.findByLabelText("Medical centre")).toHaveValue("Al Shifa Medical Centre");
    expect(screen.getByLabelText("Medical centre address")).toHaveValue("12 Mall Road, Lahore");
    expect(screen.getByLabelText("Medical appointment date")).toHaveValue("2026-11-20");
    expect(screen.getByLabelText("Medical appointment time")).toHaveValue("09:30");
  });

  it("starts empty when nothing is set yet, and saves the new defaults", async () => {
    getSetting.mockResolvedValue(setting({ centerName: null, centerAddress: null, appointmentOn: null, appointmentTime: null }));
    updateSetting.mockResolvedValue(setting());
    renderForm(await signInAs(ADMIN));

    const centre = await screen.findByLabelText("Medical centre");
    expect(centre).toHaveValue("");
    fireEvent.change(centre, { target: { value: "Al Shifa Medical Centre" } });
    fireEvent.change(screen.getByLabelText("Medical appointment time"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateSetting).toHaveBeenCalledWith({
        centerName: "Al Shifa Medical Centre", centerAddress: "", appointmentOn: "", appointmentTime: "10:00",
      })
    );
  });

  it("shows the server's validation message", async () => {
    getSetting.mockResolvedValue(setting());
    updateSetting.mockRejectedValue({ code: "VALIDATION_FAILED", message: "Appointment time is invalid" });
    renderForm(await signInAs(ADMIN));

    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByText("Appointment time is invalid")).toBeInTheDocument();
  });

  it("shows the forbidden state to staff who cannot manage the workflow", async () => {
    getSetting.mockRejectedValue({ code: "FORBIDDEN" });
    renderForm(await signInAs(HR));

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});
