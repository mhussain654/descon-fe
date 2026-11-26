import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import AdminReferenceDataPage from "./page";
import { adminReferenceDataClient } from "../../../lib/admin-reference-data-client";

vi.mock("../../../lib/admin-reference-data-client", () => ({
  adminReferenceDataClient: {
    listLookups: vi.fn(),
    createLookup: vi.fn(),
    updateLookup: vi.fn(),
    retireLookup: vi.fn(),
    restoreLookup: vi.fn(),
    deleteLookup: vi.fn(),
    getRolePermissions: vi.fn(),
    setRolePermissions: vi.fn(),
    getChecklist: vi.fn(),
    createRequirement: vi.fn(),
    updateRequirement: vi.fn(),
    listWorkflowStages: vi.fn(),
    updateWorkflowStage: vi.fn(),
    listMobilizationProcesses: vi.fn(),
  },
}));

vi.mock("../../../lib/admin-candidates-client", () => ({
  adminCandidateClient: { getCountries: vi.fn(async () => [{ code: "qatar", name: "Qatar" }]) },
}));

const client = vi.mocked(adminReferenceDataClient);

// Only the developer mock account carries manage_reference_data (shared/auth/staffAuthClient.ts).
const DEVELOPER = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "developer");
const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");

const qatar = { code: "qatar", name: "Qatar", nameEn: "Qatar", nameUr: "قطر", active: true, updatedAt: "2026-11-26T09:00:00Z" };
const oman = { code: "oman", name: "Oman", nameEn: "Oman", nameUr: "عمان", active: false, updatedAt: "2026-11-26T09:00:00Z" };

async function signInAs(account) {
  const auth = createMockStaffAuthClient({ delayMs: 0 });
  await auth.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return auth;
}

function renderAt(path, auth) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={auth}>
            <Routes>
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/forbidden" element={<p>Forbidden stub</p>} />
              <Route path="/admin/reference-data" element={<AdminReferenceDataPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminReferenceDataPage", () => {
  afterEach(() => {
    Object.values(client).forEach((fn) => fn.mockReset());
    sessionStorage.clear();
  });

  it("sends non-developers to the forbidden page", async () => {
    renderAt("/admin/reference-data", await signInAs(ADMIN));

    expect(await screen.findByText("Forbidden stub")).toBeInTheDocument();
    expect(client.listLookups).not.toHaveBeenCalled();
  });

  it("lists countries, retired ones too, and retires one", async () => {
    client.listLookups.mockResolvedValue([qatar, oman]);
    client.retireLookup.mockResolvedValue({ ...qatar, active: false });
    renderAt("/admin/reference-data", await signInAs(DEVELOPER));

    const row = (await screen.findByText("قطر")).closest("tr");
    expect(client.listLookups).toHaveBeenCalledWith("countries");
    expect(within(screen.getByText("عمان").closest("tr")).getByText("Retired")).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Retire" }));
    await waitFor(() => expect(client.retireLookup).toHaveBeenCalledWith("countries", "qatar"));
  });

  it("adds a craft with both names and the driver flag", async () => {
    client.listLookups.mockResolvedValue([]);
    client.createLookup.mockResolvedValue({ ...qatar, code: "driver_heavy" });
    renderAt("/admin/reference-data?tab=crafts", await signInAs(DEVELOPER));

    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
    expect(client.createLookup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "Driver_Heavy" } });
    fireEvent.change(screen.getByLabelText("Name (English)"), { target: { value: "Heavy driver" } });
    fireEvent.change(screen.getByLabelText("Name (Urdu)"), { target: { value: "ہیوی ڈرائیور" } });
    fireEvent.click(screen.getByLabelText("Driver craft (needs a driving licence)"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(client.createLookup).toHaveBeenCalledWith("crafts", {
        code: "driver_heavy",
        nameEn: "Heavy driver",
        nameUr: "ہیوی ڈرائیور",
        isDriver: true,
      })
    );
  });

  it("shows why an entry in use cannot be deleted", async () => {
    client.listLookups.mockResolvedValue([qatar]);
    client.deleteLookup.mockRejectedValue({ code: "IN_USE", message: "This is in use, so it cannot be deleted." });
    renderAt("/admin/reference-data", await signInAs(DEVELOPER));

    fireEvent.click(within((await screen.findByText("قطر")).closest("tr")).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByText("This is in use, so it cannot be deleted.")).toBeInTheDocument();
  });

  it("saves a role's permissions but never offers developer-only ones", async () => {
    client.getRolePermissions.mockResolvedValue({
      roles: [
        { code: "hr", name: "HR", locked: false },
        { code: "developer", name: "Developer", locked: true },
      ],
      permissions: [
        { code: "view_candidates", name: "View candidates", developerOnly: false },
        { code: "view_payments", name: "View payments", developerOnly: false },
        { code: "view_job_logs", name: "View job logs", developerOnly: true },
      ],
      grants: { hr: ["view_candidates"], developer: ["view_candidates", "view_payments", "view_job_logs"] },
    });
    client.setRolePermissions.mockImplementation(async () => client.getRolePermissions());
    renderAt("/admin/reference-data?tab=roles", await signInAs(DEVELOPER));

    expect(await screen.findByLabelText(/View job logs/)).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/View payments/));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(client.setRolePermissions).toHaveBeenCalledWith("hr", ["view_candidates", "view_payments"])
    );
  });

  it("edits a checklist row", async () => {
    const row = {
      id: "12",
      documentType: { code: "passport", name: "Passport" },
      country: null,
      project: null,
      craft: null,
      driverOnly: false,
      requirementLevel: "required",
      active: true,
      minimumFiles: 1,
      maximumFiles: 1,
      acceptedContentTypes: ["application/pdf"],
      instructionsEn: "",
      instructionsUr: "",
      updatedAt: "2026-11-26T09:00:00Z",
    };
    client.getChecklist.mockResolvedValue({
      requirements: [row],
      documentTypes: [{ code: "passport", name: "Passport" }],
      contentTypes: ["application/pdf", "image/jpeg", "image/png"],
    });
    client.updateRequirement.mockResolvedValue(row);
    renderAt("/admin/reference-data?tab=checklists", await signInAs(DEVELOPER));

    fireEvent.click(within((await screen.findByText("Passport")).closest("tr")).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Requirement"), { target: { value: "optional" } });
    fireEvent.click(screen.getByLabelText("JPEG"));
    fireEvent.change(screen.getByLabelText("Instructions (English)"), { target: { value: "Photo page only" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(client.updateRequirement).toHaveBeenCalledWith(
        "12",
        expect.objectContaining({
          requirementLevel: "optional",
          acceptedContentTypes: ["application/pdf", "image/jpeg"],
          instructionsEn: "Photo page only",
        }),
        "2026-11-26T09:00:00Z"
      )
    );
  });

  it("renames a stage and shows the processes", async () => {
    client.listWorkflowStages.mockResolvedValue([
      { code: "medical_fit", position: 10, name: "Medical fit", defaultNameEn: "Medical fit", defaultNameUr: "میڈیکل فٹ", nameEn: null, nameUr: null },
    ]);
    client.listMobilizationProcesses.mockResolvedValue([
      {
        code: "qatar",
        version: 1,
        status: "active",
        country: { code: "qatar", name: "Qatar" },
        publishedAt: null,
        stages: [{ position: 1, code: "registered", name: "Registered", required: true }],
      },
    ]);
    client.updateWorkflowStage.mockResolvedValue({});
    renderAt("/admin/reference-data?tab=stages", await signInAs(DEVELOPER));

    expect(await screen.findByText("Registered")).toBeInTheDocument();
    fireEvent.click(within(screen.getByText("medical_fit").closest("tr")).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name (English)"), { target: { value: "Medically fit" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(client.updateWorkflowStage).toHaveBeenCalledWith("medical_fit", { nameEn: "Medically fit", nameUr: "" })
    );
  });
});
