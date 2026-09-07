import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import AdminBackupsPage from "./page";
import { adminSystemBackupsClient } from "../../../lib/admin-system-backups-client";

vi.mock("../../../lib/admin-system-backups-client", () => ({
  adminSystemBackupsClient: {
    listBackups: vi.fn(),
    requestAccess: vi.fn(),
  },
}));

// Only `admin`'s mock account carries manage_backups (see
// shared/auth/staffAuthClient.ts) -- backups are infra-sensitive, not even
// management/mps see them.
const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "management");

async function signInAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function renderAt(path, client) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/backups" element={<AdminBackupsPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function backup(overrides = {}) {
  return {
    id: "2099d502-a67a-4d4b-a15a-58df5324b2d1",
    status: "succeeded",
    takenAt: "2026-09-06T00:00:00Z",
    byteSize: 10_485_760,
    checksumSha256: "b3abbcd58b14094ba6c0fea222f44367d07df2bab6c2ecd15a5b1645f93d556c",
    durationSeconds: 42,
    errorMessage: null,
    ...overrides,
  };
}

describe("AdminBackupsPage", () => {
  afterEach(() => {
    vi.mocked(adminSystemBackupsClient.listBackups).mockReset();
    vi.mocked(adminSystemBackupsClient.requestAccess).mockReset();
    sessionStorage.clear();
  });

  it("allows an admin (manage_backups) to reach the backup list", async () => {
    adminSystemBackupsClient.listBackups.mockResolvedValue({
      items: [backup()],
      pagination: { page: 1, perPage: 20, totalCount: 1, totalPages: 1 },
    });
    const client = await signInAs(ADMIN);
    renderAt("/admin/backups", client);

    expect(await screen.findByRole("heading", { name: "Database backups" })).toBeInTheDocument();
    expect(await screen.findByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("shows the backup list's own forbidden state for a management staff member -- not even management sees backups", async () => {
    adminSystemBackupsClient.listBackups.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(MANAGEMENT);
    renderAt("/admin/backups", client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/backups", client);

    expect(await screen.findByText("Login stub")).toBeInTheDocument();
  });

  it("shows an empty state when there are no backups yet", async () => {
    adminSystemBackupsClient.listBackups.mockResolvedValue({
      items: [],
      pagination: { page: 1, perPage: 20, totalCount: 0, totalPages: 0 },
    });
    const client = await signInAs(ADMIN);
    renderAt("/admin/backups", client);

    expect(await screen.findByText("No backups yet")).toBeInTheDocument();
  });

  it("does not show a Download action for a failed backup, showing its error message instead", async () => {
    adminSystemBackupsClient.listBackups.mockResolvedValue({
      items: [backup({ id: "failed-1", status: "failed", byteSize: null, durationSeconds: 3, errorMessage: 'pg_dump exited with a non-zero status' })],
      pagination: { page: 1, perPage: 20, totalCount: 1, totalPages: 1 },
    });
    const client = await signInAs(ADMIN);
    renderAt("/admin/backups", client);

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("pg_dump exited with a non-zero status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
  });

  it("requests a signed URL on Download and opens it, without eagerly fetching it on page load", async () => {
    adminSystemBackupsClient.listBackups.mockResolvedValue({
      items: [backup()],
      pagination: { page: 1, perPage: 20, totalCount: 1, totalPages: 1 },
    });
    adminSystemBackupsClient.requestAccess.mockResolvedValue({
      backupId: "2099d502-a67a-4d4b-a15a-58df5324b2d1",
      url: "/rails/active_storage/disk/abc/database_backup.sql.gz",
      expiresAt: "2026-09-06T10:05:00Z",
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const client = await signInAs(ADMIN);
    renderAt("/admin/backups", client);

    await screen.findByRole("button", { name: "Download" });
    expect(adminSystemBackupsClient.requestAccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(adminSystemBackupsClient.requestAccess).toHaveBeenCalledWith("2099d502-a67a-4d4b-a15a-58df5324b2d1"));
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    openSpy.mockRestore();
  });
});
