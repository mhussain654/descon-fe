import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminCandidateClient } from "../../../../lib/admin-candidates-client";
import { CandidateProfileCard } from "./CandidateProfileCard";

vi.mock("../../../../lib/admin-candidates-client", () => ({
  adminCandidateClient: {
    getCandidate: vi.fn(),
    createCandidate: vi.fn(),
    updateCandidate: vi.fn(),
    getCountries: vi.fn(),
    getProjects: vi.fn(),
    getCrafts: vi.fn(),
  },
}));

const HR = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "hr")!;
const MPS = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "mps")!;

async function signInAs(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function candidateDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "candidate-1",
    fullName: "Jane Applicant",
    cnic: "42101-1234567-1",
    mobileNumber: "+923001234567",
    passportNumber: "AB123456",
    preferredLocale: "en" as const,
    candidateStatus: "documents_pending",
    active: true,
    createdAt: "2026-08-30T09:00:00Z",
    updatedAt: "2026-08-30T09:00:00Z",
    assignment: {
      id: "assignment-1",
      referenceNumber: "DES-000123",
      country: { code: "qatar", name: "Qatar" },
      project: { code: "qatar_infrastructure", name: "Qatar Infrastructure" },
      craft: { code: "electrician", name: "Electrician" },
      currentWorkflowStage: { code: "documents_pending", name: "Documents Pending" },
      createdAt: "2026-08-30T09:00:00Z",
    },
    ...overrides,
  };
}

function renderCard(client: ReturnType<typeof createMockStaffAuthClient> extends Promise<infer T> ? T : never, candidateId = "candidate-1") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <CandidateProfileCard candidateId={candidateId} />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("CandidateProfileCard", () => {
  beforeEach(() => {
    adminCandidateClient.getCountries.mockResolvedValue([{ code: "qatar", name: "Qatar" }]);
    adminCandidateClient.getProjects.mockResolvedValue([{ code: "qatar_infrastructure", name: "Qatar Infrastructure" }]);
    adminCandidateClient.getCrafts.mockResolvedValue([{ code: "electrician", name: "Electrician" }]);
  });

  afterEach(() => {
    vi.mocked(adminCandidateClient.getCandidate).mockReset();
    vi.mocked(adminCandidateClient.updateCandidate).mockReset();
    vi.mocked(adminCandidateClient.getCountries).mockReset();
    vi.mocked(adminCandidateClient.getProjects).mockReset();
    vi.mocked(adminCandidateClient.getCrafts).mockReset();
    localStorage.removeItem("descon.language");
  });

  it("renders the loading state before the candidate resolves", async () => {
    adminCandidateClient.getCandidate.mockReturnValue(new Promise(() => {}));
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("renders the real candidate's profile fields, never a mock/placeholder value", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("Jane Applicant")).toBeInTheDocument();
    expect(screen.getByText("42101-1234567-1")).toBeInTheDocument();
    expect(screen.getByText("+923001234567")).toBeInTheDocument();
    expect(screen.getByText("AB123456")).toBeInTheDocument();
    expect(screen.getByText("DES-000123")).toBeInTheDocument();
    expect(screen.getByText("Qatar")).toBeInTheDocument();
    expect(screen.getByText("Qatar Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("Electrician")).toBeInTheDocument();
    expect(screen.getByText("Documents Pending")).toBeInTheDocument();
  });

  it("shows the Edit action for a staff member with manage_candidates, and hides it for a view-only role", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    const hrClient = await signInAs(HR);
    renderCard(hrClient);
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("hides the Edit action for a staff member with only view_candidates", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    const mpsClient = await signInAs(MPS);
    renderCard(mpsClient, "candidate-2");
    await screen.findByText("Jane Applicant");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("submits only the changed fields and exits edit mode on success", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    adminCandidateClient.updateCandidate.mockResolvedValue(candidateDetail({ fullName: "Jane A. Applicant" }));
    const client = await signInAs(HR);
    renderCard(client);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const nameInput = screen.getByLabelText("Full name");
    fireEvent.change(nameInput, { target: { value: "Jane A. Applicant" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminCandidateClient.updateCandidate).toHaveBeenCalledWith(
        expect.objectContaining({ candidateId: "candidate-1", fullName: "Jane A. Applicant" })
      )
    );
    const call = adminCandidateClient.updateCandidate.mock.calls[0][0];
    expect(call).not.toHaveProperty("mobileNumber");
    expect(call).not.toHaveProperty("passportNumber");
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
  });

  it("requires confirmation before submitting a changed mobile number", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    adminCandidateClient.updateCandidate.mockResolvedValue(candidateDetail({ mobileNumber: "+923009998877" }));
    const client = await signInAs(HR);
    renderCard(client);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "+923009998877" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Confirm mobile number change");
    expect(adminCandidateClient.updateCandidate).not.toHaveBeenCalled();

    const confirmButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() =>
      expect(adminCandidateClient.updateCandidate).toHaveBeenCalledWith(
        expect.objectContaining({ mobileNumber: "+923009998877" })
      )
    );
  });

  it("clears the passport number when the field is emptied", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    adminCandidateClient.updateCandidate.mockResolvedValue(candidateDetail({ passportNumber: null }));
    const client = await signInAs(HR);
    renderCard(client);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText(/Passport number/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(adminCandidateClient.updateCandidate).toHaveBeenCalledWith(expect.objectContaining({ passportNumber: "" }))
    );
  });

  it("requires the full name client-side before submitting", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    const client = await signInAs(HR);
    renderCard(client);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter the candidate's full name.")).toBeInTheDocument();
    expect(adminCandidateClient.updateCandidate).not.toHaveBeenCalled();
  });

  it("maps a duplicate passport number error to the passport field, keeping entered values", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    adminCandidateClient.updateCandidate.mockRejectedValue({
      code: "DUPLICATE_PASSPORT_NUMBER",
      message: "A candidate with this passport number already exists.",
      field: "passport_number",
    });
    const client = await signInAs(HR);
    renderCard(client);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText(/Passport number/), { target: { value: "CD999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("A candidate with this passport number already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Passport number/)).toHaveValue("CD999999");
  });

  it("shows the assignment-fields-locked notice once the candidate has moved past documents_pending", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(
      candidateDetail({
        assignment: {
          ...candidateDetail().assignment,
          currentWorkflowStage: { code: "verified", name: "Verified" },
        },
      })
    );
    const client = await signInAs(HR);
    renderCard(client);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(
      await screen.findByText("The country, project and craft can only be changed before a document has been uploaded.")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Country")).not.toBeInTheDocument();
  });

  it("allows editing project/country/craft while still at documents_pending", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    adminCandidateClient.updateCandidate.mockResolvedValue(candidateDetail());
    const client = await signInAs(HR);
    renderCard(client);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(await screen.findByLabelText("Country")).toBeInTheDocument();
  });

  it("shows a stale-conflict notice and refreshes instead of silently resubmitting", async () => {
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    adminCandidateClient.updateCandidate.mockRejectedValue({ code: "STALE_CANDIDATE" });
    const client = await signInAs(HR);
    renderCard(client);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Changed Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(adminCandidateClient.getCandidate).toHaveBeenCalledTimes(2));
  });

  it("shows a forbidden state when the backend reports the staff member cannot view this candidate", async () => {
    adminCandidateClient.getCandidate.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("You don't have permission to do that.")).toBeInTheDocument();
  });

  it("shows an offline state with retry", async () => {
    adminCandidateClient.getCandidate.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(candidateDetail());
    const client = await signInAs(HR);

    renderCard(client);

    const retryButton = await screen.findByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    await screen.findByText("Jane Applicant");
  });

  it("renders the panel in Urdu when that is the persisted language", async () => {
    localStorage.setItem("descon.language", "ur");
    adminCandidateClient.getCandidate.mockResolvedValue(candidateDetail());
    const client = await signInAs(HR);

    renderCard(client);

    expect(await screen.findByText("ذاتی معلومات")).toBeInTheDocument();
  });
});
