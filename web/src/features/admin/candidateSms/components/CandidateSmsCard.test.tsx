import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminCandidateSmsClient } from "../../../../lib/admin-candidate-sms-client";
import { CandidateSmsCard } from "./CandidateSmsCard";

vi.mock("../../../../lib/admin-candidate-sms-client", () => ({
  adminCandidateSmsClient: { getOverview: vi.fn(), send: vi.fn() },
}));

const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr" && !account.locked && !account.suspended)!;

const VISA = {
  messageCode: "visa_issued",
  automatic: true,
  locales: ["en", "ur"] as ("en" | "ur")[],
  variables: ["country"],
  prefilled: { en: { country: "Qatar" }, ur: { country: "قطر" } },
};
const FEE = {
  messageCode: "fee_pending",
  automatic: false,
  locales: ["en"] as ("en" | "ur")[],
  variables: ["name", "amount"],
  prefilled: { en: { name: "Daim Javed" } },
};

function overview(overrides: Record<string, unknown> = {}) {
  return {
    defaultLocale: "ur" as const,
    messages: [FEE, VISA],
    deliveries: [
      { id: "d-1", messageCode: "documents_submitted", locale: "ur" as const, status: "sent" as const, createdAt: "2026-11-04T09:00:00Z" },
      { id: "d-2", messageCode: "fee_pending", locale: "en" as const, status: "failed" as const, sentBy: { id: "s-1", role: "hr" }, createdAt: "2026-11-04T10:00:00Z" },
    ],
    ...overrides,
  };
}

async function renderCard() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: HR.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <CandidateSmsCard candidateId="candidate-1" />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("CandidateSmsCard", () => {
  afterEach(() => {
    vi.mocked(adminCandidateSmsClient.getOverview).mockReset();
    vi.mocked(adminCandidateSmsClient.send).mockReset();
    sessionStorage.clear();
  });

  it("lists every SMS with a template, marking the automatic ones, and shows the SMS history", async () => {
    vi.mocked(adminCandidateSmsClient.getOverview).mockResolvedValue(overview());
    await renderCard();

    const select = await screen.findByLabelText("Message");
    expect(within(select).getByRole("option", { name: "Please pay the fee" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Visa issued (Automatic)" })).toBeInTheDocument();
    expect(screen.getByText("All documents submitted for review")).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/Sent by: hr/)).toBeInTheDocument();
  });

  it("preselects the candidate's language and fills in the values the record has, in that language", async () => {
    vi.mocked(adminCandidateSmsClient.getOverview).mockResolvedValue(overview());
    await renderCard();

    fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "visa_issued" } });

    expect(screen.getByRole("radio", { name: "Urdu" })).toBeChecked();
    expect(screen.getByLabelText("Country")).toHaveValue("قطر");
    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(screen.getByLabelText("Country")).toHaveValue("Qatar");
  });

  it("disables a language the message has no template for and falls back to one it has", async () => {
    vi.mocked(adminCandidateSmsClient.getOverview).mockResolvedValue(overview());
    await renderCard();

    fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "fee_pending" } });

    expect(screen.getByRole("radio", { name: /Urdu/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Send SMS" })).toBeDisabled();
  });

  it("sends the chosen SMS with its language and values, then refreshes the history", async () => {
    vi.mocked(adminCandidateSmsClient.getOverview).mockResolvedValue(overview());
    vi.mocked(adminCandidateSmsClient.send).mockResolvedValue({
      id: "d-3", messageCode: "fee_pending", locale: "en", status: "pending", createdAt: "2026-11-04T11:00:00Z",
    });
    await renderCard();

    fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "fee_pending" } });
    fireEvent.change(screen.getByLabelText("Amount (Rs)"), { target: { value: " 1500 " } });
    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));

    await waitFor(() =>
      expect(adminCandidateSmsClient.send).toHaveBeenCalledWith(
        "candidate-1",
        { messageCode: "fee_pending", locale: "en", variables: { name: "Daim Javed", amount: "1500" } },
        expect.stringMatching(/^admin-candidate-sms-/)
      )
    );
    await waitFor(() => expect(adminCandidateSmsClient.getOverview).toHaveBeenCalledTimes(2));
  });

  it("shows the server's message on the value it names", async () => {
    vi.mocked(adminCandidateSmsClient.getOverview).mockResolvedValue(overview());
    vi.mocked(adminCandidateSmsClient.send).mockRejectedValue({
      code: "VALIDATION_FAILED", message: "Fill in every value the SMS needs.", field: "sms_message.variables.country",
    });
    await renderCard();

    fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "visa_issued" } });
    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));

    expect(await screen.findByText("Fill in every value the SMS needs.")).toBeInTheDocument();
  });

  it("says when no SMS has a template yet", async () => {
    vi.mocked(adminCandidateSmsClient.getOverview).mockResolvedValue(overview({ messages: [], deliveries: [] }));
    await renderCard();

    expect(await screen.findByText(/No SMS can be sent yet/)).toBeInTheDocument();
    expect(screen.getByText("No SMS sent to this candidate yet.")).toBeInTheDocument();
  });
});
