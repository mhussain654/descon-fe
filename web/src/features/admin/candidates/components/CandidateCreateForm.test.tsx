import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { adminCandidateClient } from "../../../../lib/admin-candidates-client";
import { CandidateCreateForm } from "./CandidateCreateForm";

// Campaigns: the default campaign is the Test campaign (no country), so the form's own
// country choice stays free; QATAR_CAMPAIGN is offered too.
const campaignMocks = vi.hoisted(() => {
  const TEST_CAMPAIGN = { id: 'campaign-test', code: 'TEST', name: 'Test campaign', kind: 'test', country: null, active: true, createdAt: '2026-11-26T00:00:00Z' };
  const QATAR_CAMPAIGN = {
    id: 'campaign-qatar', code: '2026-11-26-QATAR', name: '2026-11-26 Qatar', kind: 'regular',
    country: { code: 'qatar', name: 'Qatar' }, active: true, createdAt: '2026-11-26T00:00:00Z',
  };
  return { TEST_CAMPAIGN, QATAR_CAMPAIGN, working: { current: TEST_CAMPAIGN as unknown } };
});

vi.mock('../../campaigns/hooks/useCampaigns', () => ({
  useDefaultCampaign: () => campaignMocks.working.current,
  useCampaigns: () => ({ data: [campaignMocks.TEST_CAMPAIGN, campaignMocks.QATAR_CAMPAIGN], isPending: false, isError: false }),
  useCreateCampaign: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

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
    expect(screen.getByRole("combobox", { name: "Country" })).toBeRequired();
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

  describe("next-of-kin", () => {
    function fillNextOfKin({ name = "Ayesha Ali", relationship = "Spouse", mobileNumber = "+923001112222", cnic = "4210176543212" } = {}) {
      fireEvent.change(screen.getByLabelText(/Next-of-kin's name/), { target: { value: name } });
      fireEvent.change(screen.getByLabelText(/Relationship/), { target: { value: relationship } });
      fireEvent.change(screen.getByLabelText(/Next-of-kin's mobile number/), { target: { value: mobileNumber } });
      fireEvent.change(screen.getByLabelText(/Next-of-kin's CNIC/), { target: { value: cnic } });
    }

    it("submits all four fields together when complete valid information is provided", async () => {
      adminCandidateClient.createCandidate.mockResolvedValue({
        id: "candidate-1",
        fullName: "Jane Applicant",
        cnic: "42101-1234567-1",
        mobileNumber: "+923001234567",
        passportNumber: null,
        nextOfKin: { name: null, relationship: null, mobileNumber: null, cnic: null },
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
      fillNextOfKin();

      fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

      await waitFor(() =>
        expect(adminCandidateClient.createCandidate).toHaveBeenCalledWith(
          expect.objectContaining({
            nextOfKin: { name: "Ayesha Ali", relationship: "Spouse", mobileNumber: "+923001112222", cnic: "42101-7654321-2" },
          })
        )
      );
    });

    it("rejects partial next-of-kin information without calling the API", async () => {
      renderForm();
      await screen.findByRole("option", { name: "Qatar" });
      fillValidForm();
      fireEvent.change(screen.getByLabelText(/Next-of-kin's name/), { target: { value: "Ayesha Ali" } });

      fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

      expect(await screen.findAllByText("Complete all next-of-kin fields or leave them all blank.")).not.toHaveLength(0);
      expect(adminCandidateClient.createCandidate).not.toHaveBeenCalled();
    });

    it("rejects an invalid next-of-kin mobile number without calling the API", async () => {
      renderForm();
      await screen.findByRole("option", { name: "Qatar" });
      fillValidForm();
      fillNextOfKin({ mobileNumber: "123" });

      fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

      expect(await screen.findByText("Enter a valid next-of-kin's mobile number.")).toBeInTheDocument();
      expect(adminCandidateClient.createCandidate).not.toHaveBeenCalled();
    });

    it("rejects an invalid next-of-kin CNIC without calling the API", async () => {
      renderForm();
      await screen.findByRole("option", { name: "Qatar" });
      fillValidForm();
      fillNextOfKin({ cnic: "123" });

      fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

      expect(await screen.findByText("Enter a valid next-of-kin CNIC in the format 00000-0000000-0.")).toBeInTheDocument();
      expect(adminCandidateClient.createCandidate).not.toHaveBeenCalled();
    });

    it("maps a backend next-of-kin field error to its exact field", async () => {
      adminCandidateClient.createCandidate.mockRejectedValue({
        code: "VALIDATION_ERROR",
        message: "Enter a valid next-of-kin CNIC in the format 00000-0000000-0.",
        field: "next_of_kin_cnic",
      });
      renderForm();
      await screen.findByRole("option", { name: "Qatar" });
      fillValidForm();
      fillNextOfKin();

      fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

      expect(await screen.findByText("Enter a valid next-of-kin CNIC in the format 00000-0000000-0.")).toBeInTheDocument();
    });

    it("renders next-of-kin fields and their error in Urdu with RTL", async () => {
      localStorage.setItem("descon.language", "ur");
      renderForm();
      await screen.findByText("امیدوار شامل کریں");
      fireEvent.change(screen.getByLabelText(/قریبی رشتہ دار کا نام/), { target: { value: "عائشہ علی" } });

      fireEvent.click(screen.getByRole("button", { name: "امیدوار بنائیں" }));

      expect(await screen.findAllByText("قریبی رشتہ دار کی تمام معلومات مکمل کریں یا سب خالی چھوڑ دیں۔")).not.toHaveLength(0);
      expect(document.documentElement).toHaveAttribute("dir", "rtl");
    });
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

  describe("campaign", () => {
    afterEach(() => {
      campaignMocks.working.current = campaignMocks.TEST_CAMPAIGN;
    });

    it("starts from the default campaign and sends it with the candidate", async () => {
      adminCandidateClient.createCandidate.mockResolvedValue({ id: "candidate-1", assignment: null });
      renderForm();
      await screen.findByRole("option", { name: "Qatar" });

      expect(screen.getByLabelText("Campaign")).toHaveValue("campaign-test");
      fillValidForm();
      fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

      await waitFor(() =>
        expect(adminCandidateClient.createCandidate).toHaveBeenCalledWith(expect.objectContaining({ campaignId: "campaign-test" }))
      );
    });

    it("locks the country to a picked campaign's country", async () => {
      renderForm();
      await screen.findByRole("option", { name: "Qatar" });

      fireEvent.change(screen.getByLabelText("Campaign"), { target: { value: "campaign-qatar" } });

      expect(screen.getByLabelText(/Country/)).toHaveValue("qatar");
      expect(screen.getByLabelText(/Country/)).toBeDisabled();
      expect(screen.getByText("The country follows the campaign.")).toBeInTheDocument();
    });

    it("requires a campaign when there is no default campaign", async () => {
      campaignMocks.working.current = null;
      renderForm();
      await screen.findByRole("option", { name: "Qatar" });

      fillValidForm();
      fireEvent.click(screen.getByRole("button", { name: "Create candidate" }));

      expect(await screen.findByText("Select a campaign.")).toBeInTheDocument();
      expect(adminCandidateClient.createCandidate).not.toHaveBeenCalled();
    });
  });
});
