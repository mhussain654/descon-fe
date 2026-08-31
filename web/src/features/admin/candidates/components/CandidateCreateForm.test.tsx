import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { adminCandidateClient } from "../../../../lib/admin-candidates-client";
import { CandidateCreateForm } from "./CandidateCreateForm";

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

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <CandidateCreateForm />
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jane Applicant" } });
  fireEvent.change(screen.getByLabelText("CNIC Number"), { target: { value: "4210112345671" } });
  fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: "+923001234567" } });
  fireEvent.change(screen.getByLabelText("Country"), { target: { value: "qatar" } });
  fireEvent.change(screen.getByLabelText("Project"), { target: { value: "qatar_infrastructure" } });
  fireEvent.change(screen.getByLabelText("Craft"), { target: { value: "electrician" } });
  fireEvent.change(screen.getByLabelText("Reference number"), { target: { value: "DES-000123" } });
}

describe("CandidateCreateForm", () => {
  beforeEach(() => {
    adminCandidateClient.getCountries.mockResolvedValue([{ code: "qatar", name: "Qatar" }]);
    adminCandidateClient.getProjects.mockResolvedValue([{ code: "qatar_infrastructure", name: "Qatar Infrastructure" }]);
    adminCandidateClient.getCrafts.mockResolvedValue([{ code: "electrician", name: "Electrician" }]);
  });

  afterEach(() => {
    vi.mocked(adminCandidateClient.createCandidate).mockReset();
    vi.mocked(adminCandidateClient.getCountries).mockReset();
    vi.mocked(adminCandidateClient.getProjects).mockReset();
    vi.mocked(adminCandidateClient.getCrafts).mockReset();
    localStorage.removeItem("descon.language");
  });

  it("populates country/project/craft selects from the real reference-data endpoints, never a hardcoded list", async () => {
    renderForm();

    expect(await screen.findByRole("option", { name: "Qatar" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Qatar Infrastructure" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Electrician" })).toBeInTheDocument();
  });

  it("shows an empty state for a reference-data list that has no active options", async () => {
    adminCandidateClient.getCrafts.mockResolvedValue([]);
    renderForm();

    expect(await screen.findByText("No crafts are available right now.")).toBeInTheDocument();
  });

  it("shows an inline error with retry when a reference-data list fails to load, without blocking the rest of the form", async () => {
    adminCandidateClient.getCrafts.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce([
      { code: "electrician", name: "Electrician" },
    ]);
    renderForm();

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Qatar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("option", { name: "Electrician" })).toBeInTheDocument();
  });

  it("requires every required field client-side before submitting", async () => {
    renderForm();
    await screen.findByRole("option", { name: "Qatar" });

    fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

    expect(await screen.findByText("Enter the candidate's full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid CNIC in the format 00000-0000000-0.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid mobile number.")).toBeInTheDocument();
    expect(screen.getByText("Select a country.")).toBeInTheDocument();
    expect(screen.getByText("Select a project.")).toBeInTheDocument();
    expect(screen.getByText("Select a craft.")).toBeInTheDocument();
    expect(screen.getByText("Enter the assignment reference number.")).toBeInTheDocument();
    expect(adminCandidateClient.createCandidate).not.toHaveBeenCalled();
  });

  it("submits the normalized, formatted values on success", async () => {
    adminCandidateClient.createCandidate.mockResolvedValue({
      id: "candidate-1",
      fullName: "Jane Applicant",
      cnic: "42101-1234567-1",
      mobileNumber: "+923001234567",
      passportNumber: null,
      preferredLocale: "en",
      candidateStatus: "documents_pending",
      active: true,
      createdAt: "2026-08-30T09:00:00Z",
      updatedAt: "2026-08-30T09:00:00Z",
      assignment: null,
    });
    renderForm();
    await screen.findByRole("option", { name: "Qatar" });
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

    await waitFor(() =>
      expect(adminCandidateClient.createCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: "Jane Applicant",
          cnic: "42101-1234567-1",
          mobileNumber: "+923001234567",
          countryCode: "qatar",
          projectCode: "qatar_infrastructure",
          craftCode: "electrician",
          referenceNumber: "DES-000123",
        })
      )
    );
  });

  it("prevents a duplicate submission while the request is pending", async () => {
    adminCandidateClient.createCandidate.mockReturnValue(new Promise(() => {}));
    renderForm();
    await screen.findByRole("option", { name: "Qatar" });
    fillValidForm();

    const button = screen.getByRole("button", { name: "Create candidate" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(adminCandidateClient.createCandidate).toHaveBeenCalledTimes(1));
  });

  it("maps a duplicate CNIC error to the CNIC field", async () => {
    adminCandidateClient.createCandidate.mockRejectedValue({
      code: "DUPLICATE_CNIC",
      message: "A candidate with this CNIC already exists.",
      field: "cnic",
    });
    renderForm();
    await screen.findByRole("option", { name: "Qatar" });
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

    expect(await screen.findByText("A candidate with this CNIC already exists.")).toBeInTheDocument();
  });

  it("shows a non-field error for a failure the backend does not attribute to one field", async () => {
    adminCandidateClient.createCandidate.mockRejectedValue({ code: "SERVER_ERROR" });
    renderForm();
    await screen.findByRole("option", { name: "Qatar" });
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });

  it("renders the form in Urdu when that is the persisted language", async () => {
    localStorage.setItem("descon.language", "ur");
    renderForm();

    expect(await screen.findByText("امیدوار شامل کریں")).toBeInTheDocument();
  });
});
