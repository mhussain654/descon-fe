import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminCandidateClient } from "../../../../lib/admin-candidates-client";
import { ProfilePhotoReviewCard } from "./ProfilePhotoReviewCard";

vi.mock("../../../../lib/admin-candidates-client", () => ({
  adminCandidateClient: { getCandidate: vi.fn(), decideProfilePhoto: vi.fn() },
}));

const HR = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "hr")!;
const FINANCE = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "finance")!;
const PHOTO_PATH = "/rails/active_storage/blobs/proxy/abc/profile-photo.jpg";

function candidate(profilePhoto: unknown) {
  return {
    id: "candidate-1",
    fullName: "Jane Applicant",
    cnic: "42101-1234567-1",
    mobileNumber: "+923001234567",
    passportNumber: null,
    nextOfKin: { name: null, relationship: null, mobileNumber: null, cnic: null },
    preferredLocale: "en" as const,
    candidateStatus: "documents_pending",
    active: true,
    createdAt: "2026-08-30T09:00:00Z",
    updatedAt: "2026-08-30T09:00:00Z",
    assignment: null,
    profilePhoto,
  };
}

async function renderCard(account: { email: string }) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <ProfilePhotoReviewCard candidateId="candidate-1" />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("ProfilePhotoReviewCard", () => {
  afterEach(() => {
    vi.mocked(adminCandidateClient.getCandidate).mockReset();
    vi.mocked(adminCandidateClient.decideProfilePhoto).mockReset();
  });

  it("shows a photo waiting for review and approves it", async () => {
    vi.mocked(adminCandidateClient.getCandidate).mockResolvedValue(candidate({ status: "pending", url: PHOTO_PATH, reviewedAt: null }));
    vi.mocked(adminCandidateClient.decideProfilePhoto).mockResolvedValue({ status: "approved", url: PHOTO_PATH, reviewedAt: "2026-11-07T10:00:00Z" });
    await renderCard(HR);

    expect(await screen.findByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Profile photo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(adminCandidateClient.decideProfilePhoto).toHaveBeenCalledWith("candidate-1", "approved"));
    expect(await screen.findByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("rejects after confirming, and says the candidate was asked for a new photo", async () => {
    vi.mocked(adminCandidateClient.getCandidate).mockResolvedValue(candidate({ status: "pending", url: PHOTO_PATH, reviewedAt: null }));
    vi.mocked(adminCandidateClient.decideProfilePhoto).mockResolvedValue({ status: "rejected", url: null, reviewedAt: "2026-11-07T10:00:00Z" });
    await renderCard(HR);

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(screen.getByText("Reject this photo?")).toBeInTheDocument();
    const dialogButtons = screen.getAllByRole("button", { name: "Reject" });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => expect(adminCandidateClient.decideProfilePhoto).toHaveBeenCalledWith("candidate-1", "rejected"));
    expect(await screen.findByText(/asked to upload a clear photo of their own face/)).toBeInTheDocument();
  });

  it("shows the photo without actions to staff who cannot review documents", async () => {
    vi.mocked(adminCandidateClient.getCandidate).mockResolvedValue(candidate({ status: "pending", url: PHOTO_PATH, reviewedAt: null }));
    await renderCard(FINANCE);

    expect(await screen.findByRole("img", { name: "Profile photo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it("says when the candidate has no photo", async () => {
    vi.mocked(adminCandidateClient.getCandidate).mockResolvedValue(candidate({ status: null, url: null, reviewedAt: null }));
    await renderCard(HR);

    expect(await screen.findByText("The candidate has not added a photo.")).toBeInTheDocument();
  });
});
