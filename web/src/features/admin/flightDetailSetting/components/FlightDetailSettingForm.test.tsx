import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminFlightDetailSettingClient } from "../../../../lib/admin-flight-detail-setting-client";
import { FlightDetailSettingForm } from "./FlightDetailSettingForm";

vi.mock("../../../../lib/admin-flight-detail-setting-client", () => ({
  adminFlightDetailSettingClient: { getFlightDetailSetting: vi.fn(), updateFlightDetailSetting: vi.fn() },
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
          <FlightDetailSettingForm />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function setting(overrides: Record<string, unknown> = {}) {
  return {
    airline: "Qatar Airways",
    flightNumber: "QR-615",
    sector: "LHE-DOH",
    departureOn: "2026-11-20",
    departureTime: "14:30",
    updatedBy: undefined,
    updatedAt: "2026-11-14T09:00:00Z",
    ...overrides,
  };
}

const getSetting = vi.mocked(adminFlightDetailSettingClient.getFlightDetailSetting);
const updateSetting = vi.mocked(adminFlightDetailSettingClient.updateFlightDetailSetting);

describe("FlightDetailSettingForm", () => {
  afterEach(() => {
    getSetting.mockReset();
    updateSetting.mockReset();
    sessionStorage.clear();
  });

  it("shows the current default airline, flight number, sector and departure", async () => {
    getSetting.mockResolvedValue(setting());
    renderForm(await signInAs(ADMIN));

    expect(await screen.findByLabelText("Airline")).toHaveValue("Qatar Airways");
    expect(screen.getByLabelText("Flight number")).toHaveValue("QR-615");
    expect(screen.getByLabelText("Route (from – to)")).toHaveValue("LHE-DOH");
    expect(screen.getByLabelText("Departure date")).toHaveValue("2026-11-20");
    expect(screen.getByLabelText("Departure time")).toHaveValue("14:30");
  });

  it("starts empty when nothing is set yet, and saves the new defaults", async () => {
    getSetting.mockResolvedValue(
      setting({ airline: null, flightNumber: null, sector: null, departureOn: null, departureTime: null })
    );
    updateSetting.mockResolvedValue(setting());
    renderForm(await signInAs(ADMIN));

    const airline = await screen.findByLabelText("Airline");
    expect(airline).toHaveValue("");
    fireEvent.change(airline, { target: { value: "Qatar Airways" } });
    fireEvent.change(screen.getByLabelText("Departure date"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("Departure time"), { target: { value: "14:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateSetting).toHaveBeenCalledWith({
        airline: "Qatar Airways", flightNumber: "", sector: "", departureOn: "2026-11-20", departureTime: "14:30",
      })
    );
  });

  it("shows the server's validation message", async () => {
    getSetting.mockResolvedValue(setting());
    updateSetting.mockRejectedValue({ code: "VALIDATION_FAILED", message: "Departure time can't be blank" });
    renderForm(await signInAs(ADMIN));

    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByText("Departure time can't be blank")).toBeInTheDocument();
  });

  it("shows the forbidden state to staff who cannot manage the workflow", async () => {
    getSetting.mockRejectedValue({ code: "FORBIDDEN" });
    renderForm(await signInAs(HR));

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });
});
