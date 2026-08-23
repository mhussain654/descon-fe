import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import StaffUsersPage from "./page";

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");
const VIEWER = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "viewer" && !account.locked && !account.suspended);

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

/** "Ayesha Admin" (the signed-in admin) appears both in the StaffShell header and in the table row -- scope row lookups to the table body to disambiguate. */
function tableRowFor(name) {
  return within(screen.getByRole("table")).getByText(name).closest("tr");
}

describe("StaffUsersPage", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("lists the seeded staff with role and status", async () => {
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    const table = screen.getByRole("table");
    expect(within(table).getByText("Ayesha Admin")).toBeInTheDocument();
    expect(within(table).getByText("Bilal Manager")).toBeInTheDocument();
    expect(within(table).getByText("Zara Zaidi")).toBeInTheDocument();
  });

  it("redirects a viewer (lacking canManageStaff) to the forbidden route, never rendering the table", async () => {
    const client = await signInAs(VIEWER);
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
    expect(screen.queryByText("Bilal Manager")).not.toBeInTheDocument();
  });

  it("filters the list by search query", async () => {
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bilal" } });

    await waitFor(() => expect(within(screen.getByRole("table")).queryByText("Ayesha Admin")).not.toBeInTheDocument());
    expect(within(screen.getByRole("table")).getByText("Bilal Manager")).toBeInTheDocument();
  });

  it("invites a new staff member and refreshes the list without a page reload", async () => {
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.click(screen.getByRole("button", { name: "+ Invite staff" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Person" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new.person@descon.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() => expect(screen.getByText("New Person")).toBeInTheDocument());
    // The invite dialog itself closed on success.
    expect(screen.queryByText("Invite staff member")).not.toBeInTheDocument();
  });

  it("shows a field-addressable error for a duplicate email invite, without closing the dialog", async () => {
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    fireEvent.click(screen.getByRole("button", { name: "+ Invite staff" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Duplicate" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    const emailField = await screen.findByLabelText("Email");
    await waitFor(() => expect(emailField).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("A staff member with this email already exists.")).toBeInTheDocument();
    // The dialog stays open so the staff member can correct the field.
    expect(screen.getByText("Invite staff member")).toBeInTheDocument();
  });

  it("suspends a staff member after explicit confirmation", async () => {
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    // A distinct target from the other mutating tests below -- the staff
    // directory client is a module-level singleton shared across every test
    // in this file (matching production, where it really is one instance
    // for the session), so each mutating test uses its own row to stay
    // independent of the others' side effects.
    const targetRow = tableRowFor("Hamza Haroon");
    fireEvent.click(within(targetRow).getByRole("button", { name: "Suspend" }));

    expect(screen.getByText("Suspend staff member")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));

    await waitFor(() => {
      expect(within(tableRowFor("Hamza Haroon")).getByText("Suspended")).toBeInTheDocument();
    });
  });

  it("requires an explicit confirmation step for a role downgrade before applying it", async () => {
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    // Manager -> viewer is a downgrade. (Demoting the signed-in admin's own
    // row is impossible through this UI at all -- actions are hidden there,
    // see "does not render role/status actions on the current staff
    // member's own row" -- and the "last remaining admin" business rule
    // itself is covered directly against the client in
    // shared/staffAdmin/staffDirectoryClient.test.ts.)
    const managerRow = tableRowFor("Bilal Manager");
    fireEvent.click(within(managerRow).getByRole("button", { name: "Change role" }));

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "viewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // A downgrade requires an explicit confirmation step, not an immediate
    // change -- the mutation must not have been called yet. (The table
    // itself is aria-hidden by the open modal at this point, per Radix's
    // modal semantics, so it isn't queried here.)
    expect(screen.getByText("Confirm role downgrade")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(within(tableRowFor("Bilal Manager")).getByText("Viewer")).toBeInTheDocument());
    expect(screen.queryByText("Confirm role downgrade")).not.toBeInTheDocument();
  });

  it("does not require confirmation for a role upgrade", async () => {
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    const viewerRow = screen.getByText("Sana Viewer").closest("tr");
    fireEvent.click(within(viewerRow).getByRole("button", { name: "Change role" }));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "manager" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByText("Confirm role downgrade")).not.toBeInTheDocument();
    await waitFor(() => {
      const row = screen.getByText("Sana Viewer").closest("tr");
      expect(within(row).getByText("Manager")).toBeInTheDocument();
    });
  });

  it("does not render role/status actions on the current staff member's own row", async () => {
    const client = await signInAs(ADMIN);
    await renderUsersPage(client);

    const ownRow = tableRowFor("Ayesha Admin");
    expect(within(ownRow).queryByRole("button", { name: "Change role" })).not.toBeInTheDocument();
    expect(within(ownRow).queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(within(ownRow).getByText("You")).toBeInTheDocument();
  });
});
