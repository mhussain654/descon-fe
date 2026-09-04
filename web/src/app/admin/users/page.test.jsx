import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import StaffUsersPage from "./page";
import { staffDirectoryClient } from "../../../lib/staff-directory-client";

vi.mock("../../../lib/staff-directory-client", () => ({
  staffDirectoryClient: {
    listStaff: vi.fn(),
    inviteStaff: vi.fn(),
    updateStaffRole: vi.fn(),
    updateStaffStatus: vi.fn(),
  },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr" && !account.locked && !account.suspended);

/** Real-backend-shaped fixtures (Users::SummarySerializer): id/email/role/staff_state/active/created_at, no name -- matches shared/staffAdmin/types.ts exactly. */
function seedStaff() {
  return [
    { id: "staff_admin_1", email: "admin@descon.com", role: "admin", status: "active", createdAt: "2026-06-01T00:00:00Z" },
    { id: "staff_hr_1", email: "hr@descon.com", role: "hr", status: "active", createdAt: "2026-06-05T00:00:00Z" },
    { id: "staff_finance_1", email: "finance@descon.com", role: "finance", status: "active", createdAt: "2026-06-10T00:00:00Z" },
    { id: "staff_invited_1", email: "hamza.haroon@descon.com", role: "hr", status: "invited", createdAt: "2026-08-30T00:00:00Z" },
    { id: "staff_suspended_1", email: "zara.zaidi@descon.com", role: "finance", status: "suspended", createdAt: "2026-05-01T00:00:00Z" },
  ];
}

async function signInAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

async function renderUsersPage(client) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <MemoryRouter initialEntries={["/admin/users"]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <StaffUsersPage />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  await screen.findByRole("table");
  return result;
}

function tableRowFor(email) {
  return within(screen.getByRole("table")).getByText(email).closest("tr");
}

describe("StaffUsersPage", () => {
  afterEach(() => {
    vi.mocked(staffDirectoryClient.listStaff).mockReset();
    vi.mocked(staffDirectoryClient.inviteStaff).mockReset();
    vi.mocked(staffDirectoryClient.updateStaffRole).mockReset();
    vi.mocked(staffDirectoryClient.updateStaffStatus).mockReset();
    sessionStorage.clear();
  });

  it("lists the seeded staff with role and status", async () => {
    staffDirectoryClient.listStaff.mockResolvedValue(seedStaff());
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    const table = screen.getByRole("table");
    expect(within(table).getByText("admin@descon.com")).toBeInTheDocument();
    expect(within(table).getByText("hr@descon.com")).toBeInTheDocument();
    expect(within(table).getByText("zara.zaidi@descon.com")).toBeInTheDocument();
  });

  it("redirects a non-admin (lacking the admin-only role) to the forbidden route, never rendering the table", async () => {
    staffDirectoryClient.listStaff.mockResolvedValue(seedStaff());
    const client = await signInAs(HR);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <StaffAuthProvider client={client}>
              <Routes>
                <Route path="/admin/forbidden" element={<p>Forbidden stub</p>} />
                <Route path="/admin/users" element={<StaffUsersPage />} />
              </Routes>
            </StaffAuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Forbidden stub")).toBeInTheDocument());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("hr@descon.com")).not.toBeInTheDocument();
  });

  it("redirects an admin-*role* staff member who lacks the manage_staff_users *permission* -- role alone never grants access", async () => {
    // A hand-rolled fake, not the mock (which always pairs role:'admin'
    // with manage_staff_users) -- this is the only way to prove the guard
    // checks the backend-issued permission, not the role string.
    const adminWithoutPermission = {
      signIn: async () => ({
        staffId: "staff-odd",
        email: "admin-without-permission@descon.com",
        role: "admin",
        permissions: [],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      restoreSession: async () => null,
      signOut: async () => {},
      authenticatedRequest: async () => undefined,
    };
    const session = await adminWithoutPermission.signIn();
    const client = { ...adminWithoutPermission, restoreSession: async () => session };

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <StaffAuthProvider client={client}>
              <Routes>
                <Route path="/admin/forbidden" element={<p>Forbidden stub</p>} />
                <Route path="/admin/users" element={<StaffUsersPage />} />
              </Routes>
            </StaffAuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Forbidden stub")).toBeInTheDocument());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("filters the list by search query", async () => {
    staffDirectoryClient.listStaff.mockImplementation(async (params = {}) => {
      const all = seedStaff();
      if (!params.query) return all;
      return all.filter((member) => member.email.includes(params.query));
    });
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "hr@descon" } });

    await waitFor(() => expect(within(screen.getByRole("table")).queryByText("admin@descon.com")).not.toBeInTheDocument());
    expect(within(screen.getByRole("table")).getByText("hr@descon.com")).toBeInTheDocument();
  });

  it("invites a new staff member and refreshes the list without a page reload", async () => {
    const invited = {
      id: "staff_new_1",
      email: "new.person@descon.com",
      role: "hr",
      status: "invited",
      createdAt: new Date().toISOString(),
    };
    // First resolution is the page's initial load; the second is the
    // refetch `invalidateStaffList()` triggers after a successful invite --
    // matching production, where the real backend's second GET reflects
    // the just-created row.
    staffDirectoryClient.listStaff.mockResolvedValueOnce(seedStaff()).mockResolvedValue([...seedStaff(), invited]);
    staffDirectoryClient.inviteStaff.mockResolvedValue(invited);
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.click(screen.getByRole("button", { name: "+ Invite staff" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new.person@descon.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => expect(screen.getByText("new.person@descon.com")).toBeInTheDocument());
    // The invite dialog itself closed on success.
    expect(screen.queryByText("Invite staff member")).not.toBeInTheDocument();
  });

  it("shows a field-addressable error for a duplicate email invite, without closing the dialog", async () => {
    staffDirectoryClient.listStaff.mockResolvedValue(seedStaff());
    staffDirectoryClient.inviteStaff.mockRejectedValue({
      status: 422,
      code: "HTTP_4XX",
      serverCode: "validation_failed",
      field: "email",
      errors: [{ code: "validation_failed", field: "email", message: "Email has already been taken" }],
    });
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.click(screen.getByRole("button", { name: "+ Invite staff" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    const emailField = await screen.findByLabelText("Email");
    await waitFor(() => expect(emailField).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("Email has already been taken")).toBeInTheDocument();
    // The dialog stays open so the staff member can correct the field.
    expect(screen.getByText("Invite staff member")).toBeInTheDocument();
  });

  it("suspends a staff member after explicit confirmation", async () => {
    staffDirectoryClient.listStaff.mockResolvedValue(seedStaff());
    staffDirectoryClient.updateStaffStatus.mockResolvedValue({
      id: "staff_invited_1",
      email: "hamza.haroon@descon.com",
      role: "hr",
      status: "suspended",
      createdAt: "2026-08-30T00:00:00Z",
    });
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    // A distinct target from the other mutating tests below -- each
    // mutating test asserts only against its own mocked resolution, so
    // they stay independent of each other's side effects.
    const targetRow = tableRowFor("hamza.haroon@descon.com");
    fireEvent.click(within(targetRow).getByRole("button", { name: "Suspend" }));

    expect(screen.getByText("Suspend staff member")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));

    await waitFor(() => {
      expect(staffDirectoryClient.updateStaffStatus).toHaveBeenCalledWith("staff_invited_1", "suspended");
    });
  });

  it("treats selecting a member's current role as a no-op -- no mutation call, dialog just closes", async () => {
    staffDirectoryClient.listStaff.mockResolvedValue(seedStaff());
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.click(within(tableRowFor("hr@descon.com")).getByRole("button", { name: "Change role" }));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "hr" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(staffDirectoryClient.updateStaffRole).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Role")).not.toBeInTheDocument();
  });

  it("does not require confirmation for a role upgrade", async () => {
    staffDirectoryClient.listStaff.mockResolvedValue(seedStaff());
    staffDirectoryClient.updateStaffRole.mockResolvedValue({
      id: "staff_finance_1",
      email: "finance@descon.com",
      role: "admin",
      status: "active",
      createdAt: "2026-06-10T00:00:00Z",
    });
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.click(within(tableRowFor("finance@descon.com")).getByRole("button", { name: "Change role" }));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByText("Confirm role downgrade")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(staffDirectoryClient.updateStaffRole).toHaveBeenCalledWith("staff_finance_1", "admin");
    });
  });

  it("requires confirmation for a role downgrade and applies it only after confirming", async () => {
    // Only `admin` outranks the other four (peer) roles (STAFF_ROLE_RANK),
    // so demonstrating a downgrade needs a second admin first -- promote
    // finance to admin (an upgrade, immediate, no confirmation), then demote
    // them back, which *is* a genuine downgrade. The signed-in admin's own
    // row hides actions entirely, so it can't be used for either step.
    const financeAsAdmin = { id: "staff_finance_1", email: "finance@descon.com", role: "admin", status: "active", createdAt: "2026-06-10T00:00:00Z" };
    staffDirectoryClient.listStaff
      .mockResolvedValueOnce(seedStaff())
      .mockResolvedValue(seedStaff().map((member) => (member.id === "staff_finance_1" ? financeAsAdmin : member)));
    staffDirectoryClient.updateStaffRole.mockImplementation(async (staffId, role) => ({ ...financeAsAdmin, id: staffId, role }));

    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.click(within(tableRowFor("finance@descon.com")).getByRole("button", { name: "Change role" }));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(staffDirectoryClient.updateStaffRole).toHaveBeenCalledWith("staff_finance_1", "admin"));
    await waitFor(() => expect(within(tableRowFor("finance@descon.com")).getByText("Admin")).toBeInTheDocument());

    fireEvent.click(within(tableRowFor("finance@descon.com")).getByRole("button", { name: "Change role" }));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "hr" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Confirm role downgrade")).toBeInTheDocument();
    expect(staffDirectoryClient.updateStaffRole).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(staffDirectoryClient.updateStaffRole).toHaveBeenCalledWith("staff_finance_1", "hr");
    });
    expect(screen.queryByText("Confirm role downgrade")).not.toBeInTheDocument();
  });

  it("does not render role/status actions on the current staff member's own row", async () => {
    staffDirectoryClient.listStaff.mockResolvedValue(seedStaff());
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    const ownRow = tableRowFor("admin@descon.com");
    expect(within(ownRow).queryByRole("button", { name: "Change role" })).not.toBeInTheDocument();
    expect(within(ownRow).queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(within(ownRow).getByText("You")).toBeInTheDocument();
  });
});
