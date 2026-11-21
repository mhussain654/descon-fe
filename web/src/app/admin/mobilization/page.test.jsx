import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import AdminMobilizationPage from "./page";
import { translations } from "../../../../../shared/i18n/translations";
import { adminCandidateClient } from "../../../lib/admin-candidates-client";

vi.mock("../../../lib/admin-candidates-client", () => ({
  adminCandidateClient: { listMobilizations: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "admin");

async function signedInClient() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function row(overrides = {}) {
  return {
    id: "flight-1",
    candidate: { id: "candidate-1", fullName: "Ali Raza", referenceNumber: "DES-000123", countryName: "Qatar", projectName: "Qatar Infrastructure", craftName: "Electrician" },
    airline: "Qatar Airways",
    flightNumber: "QR-629",
    sector: "LHE-DOH",
    flightDepartureAt: "2026-11-19T21:00:00Z",
    ticketAttached: true,
    boardingPassUploadedAt: null,
    mobilizedOn: null,
    status: "scheduled",
    ...overrides,
  };
}

function result(items, summary = { total: items.length, boardingPass: { uploaded: 0, missing: items.length }, status: { scheduled: items.length, departing_today: 0, departed: 0, not_confirmed: 0 } }) {
  return { items, pagination: { page: 1, perPage: 20, totalCount: items.length, totalPages: 1 }, summary };
}

async function renderAt(path) {
  const client = await signedInClient();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/mobilization" element={<AdminMobilizationPage />} />
              <Route path="/admin/candidates/:id" element={<p>Candidate detail stub</p>} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("Admin Mobilization page", () => {
  it("lists each booked candidate with flight, departure in Pakistan time, ticket, boarding pass and status, and counts", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockResolvedValue(
      result(
        [row(), row({ id: "flight-2", candidate: { ...row().candidate, id: "candidate-2", fullName: "Bilal Khan" }, boardingPassUploadedAt: "2026-11-19T16:40:00Z", mobilizedOn: "2026-11-20", status: "departed", ticketAttached: false })],
        { total: 300, boardingPass: { uploaded: 180, missing: 120 }, status: { scheduled: 250, departing_today: 30, departed: 10, not_confirmed: 10 } }
      )
    );
    await renderAt("/admin/mobilization");

    expect(await screen.findByRole("link", { name: "Ali Raza" })).toHaveAttribute("href", "/admin/candidates/candidate-1");
    expect(screen.getAllByText("QR-629 · LHE-DOH").length).toBeGreaterThan(0);
    // 21:00 UTC on 19 Nov is 02:00 on 20 Nov in Pakistan.
    expect(screen.getAllByText("20 Nov 2026, 02:00").length).toBe(2);
    expect(screen.getByText("Not uploaded")).toBeInTheDocument();
    expect(screen.getByText("Uploaded 19 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    // Left on the flight's own day: just "Departed", the date is already in the Departure column.
    // (The summary card shares the word, so the board reads as one.)
    expect(screen.getAllByText("Departed").length).toBeGreaterThan(1);
    expect(screen.queryByText(/^on \d/)).toBeNull();
    expect(screen.getByText("Not attached")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /180\s*Boarding pass uploaded/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /120\s*Boarding pass not uploaded/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /10\s*Departure not confirmed/ })).toBeInTheDocument();
  });

  it("shows departing today, not confirmed, and a departure confirmed by the boarding pass", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockResolvedValue(
      result([
        row({ status: "departing_today" }),
        row({ id: "flight-2", candidate: { ...row().candidate, id: "candidate-2", fullName: "Bilal Khan" }, status: "not_confirmed" }),
        row({ id: "flight-3", candidate: { ...row().candidate, id: "candidate-3", fullName: "Kamran Ali" }, boardingPassUploadedAt: "2026-11-19T16:40:00Z", status: "departed" }),
      ])
    );
    await renderAt("/admin/mobilization");

    expect(await screen.findByText("Departing today")).toBeInTheDocument();
    expect(screen.getByText("Not confirmed")).toBeInTheDocument();
    expect(screen.getByText("Confirmed by boarding pass")).toBeInTheDocument();
  });

  it("filters to departures that are not confirmed from its summary card", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockResolvedValue(result([row()]));
    await renderAt("/admin/mobilization");
    await screen.findByRole("link", { name: "Ali Raza" });

    fireEvent.click(screen.getByRole("button", { name: /Departure not confirmed/ }));

    await waitFor(() =>
      expect(adminCandidateClient.listMobilizations).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "not_confirmed" }),
        undefined,
        { number: 1, size: 20 }
      )
    );
  });

  it("adds the day under Departed only when the candidate left on a different day from the booked flight", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockResolvedValue(
      result([row({ mobilizedOn: "2026-11-21", status: "departed" })], { total: 1, boardingPass: { uploaded: 0, missing: 1 }, status: { scheduled: 0, departing_today: 0, departed: 1, not_confirmed: 0 } })
    );
    await renderAt("/admin/mobilization");

    expect(await screen.findByText("on 21 Nov 2026")).toBeInTheDocument();
  });

  it("passes the date and boarding pass filters from the URL to the backend", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockResolvedValue(result([row()]));
    await renderAt("/admin/mobilization?flight_date=2026-11-20&boarding_pass=missing");

    await screen.findByRole("link", { name: "Ali Raza" });
    expect(adminCandidateClient.listMobilizations).toHaveBeenCalledWith(
      expect.objectContaining({ flightDate: "2026-11-20", boardingPass: "missing" }),
      undefined,
      { number: 1, size: 20 }
    );
  });

  it("filters to not-uploaded boarding passes from its summary card", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockResolvedValue(result([row()]));
    await renderAt("/admin/mobilization?flight_date=2026-11-20");
    await screen.findByRole("link", { name: "Ali Raza" });

    fireEvent.click(screen.getByRole("button", { name: /Boarding pass not uploaded/ }));

    await waitFor(() =>
      expect(adminCandidateClient.listMobilizations).toHaveBeenLastCalledWith(
        expect.objectContaining({ flightDate: "2026-11-20", boardingPass: "missing" }),
        undefined,
        { number: 1, size: 20 }
      )
    );
  });

  it("shows today's flights, earliest first, from the shortcut", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockResolvedValue(result([row()]));
    await renderAt("/admin/mobilization");
    await screen.findByRole("link", { name: "Ali Raza" });

    fireEvent.click(screen.getByRole("button", { name: "Today’s flights" }));

    await waitFor(() =>
      expect(adminCandidateClient.listMobilizations).toHaveBeenLastCalledWith(
        expect.objectContaining({ flightDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
        "departure_at",
        { number: 1, size: 20 }
      )
    );
  });

  it("explains an empty list before any flight is booked", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockResolvedValue(result([]));
    await renderAt("/admin/mobilization");

    expect(await screen.findByText("No booked flights yet")).toBeInTheDocument();
  });

  it("shows the forbidden state when the backend refuses", async () => {
    vi.mocked(adminCandidateClient.listMobilizations).mockRejectedValue({ code: "FORBIDDEN" });
    await renderAt("/admin/mobilization");

    await waitFor(() => expect(adminCandidateClient.listMobilizations).toHaveBeenCalled());
    expect(await screen.findByText(translations.en.dsForbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
