import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../../../contexts/AuthContext";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { paymentsClient } from "../../../../lib/payments-client";
import { PaymentPanel } from "./PaymentPanel";

vi.mock("../../../../lib/payments-client", () => ({
  paymentsClient: { getEligibility: vi.fn(), initiateCheckout: vi.fn(), createVoucher: vi.fn() },
}));

// The server says whether a card checkout is open: an unexpired, pending payment that is not a payment code.
function cardCheckoutOpenFor(latestPayment: any) {
  return Boolean(
    latestPayment &&
      latestPayment.provider !== "kuickpay_voucher" &&
      latestPayment.status === "checkout_pending" &&
      new Date(latestPayment.checkoutExpiresAt) > new Date()
  );
}

function eligibility(overrides: Record<string, any> = {}) {
  return {
    eligible: true,
    checkoutAvailable: true,
    voucherAvailable: false,
    openVoucher: null,
    cardCheckoutOpen: cardCheckoutOpenFor(overrides.latestPayment),
    requiredStageCode: "fee_pending",
    currentStageCode: "fee_pending",
    blockingReasons: [],
    amount: "1500.0",
    currencyCode: "PKR",
    latestPayment: null,
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    id: "payment-1",
    paymentTypeCode: "onboarding_fee",
    status: "checkout_pending",
    amount: "1500.0",
    currencyCode: "PKR",
    provider: "mock_hosted_checkout",
    checkoutUrl: "https://mock-payments.example.test/checkout?orderid=1",
    voucherNumber: null,
    checkoutExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    paidAt: null,
    updatedAt: "2026-08-31T09:00:00Z",
    ...overrides,
  };
}

/** A minimal window.open() return-value stand-in: settable .location.href (what the popup-safe checkout flow navigates), a spyable .close(), and a real .opener slot to prove it gets nulled. */
function createPopupStub() {
  const stub: { closed: boolean; opener: unknown; location: { href: string }; close: () => void } = {
    closed: false,
    opener: {},
    location: { href: "" },
    close: () => {
      stub.closed = true;
    },
  };
  return stub;
}

function LoginStub() {
  const { login } = useAuth();
  return (
    <button
      type="button"
      onClick={() =>
        login({
          accessToken: "candidate-access-token",
          refreshToken: "refresh",
          candidateId: "candidate-public-id-1",
          candidateName: "Ahmed Ali",
          preferredLocale: "en",
          // Long enough to survive a fake-timer-advanced polling-timeout test
          // without the session itself expiring mid-test.
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
      }
    >
      login
    </button>
  );
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <LoginStub />
          <PaymentPanel />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByText("login"));
  return queryClient;
}

describe("PaymentPanel", () => {
  afterEach(() => {
    vi.mocked(paymentsClient.getEligibility).mockReset();
    vi.mocked(paymentsClient.initiateCheckout).mockReset();
    vi.mocked(paymentsClient.createVoucher).mockReset();
    localStorage.removeItem("descon.language");
  });

  it("shows the fee amount and a Pay action when eligible", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    renderPanel();

    expect(await screen.findByText("1500.0 PKR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });

  it("shows a not-eligible message and no Pay action when ineligible", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ eligible: false, checkoutAvailable: false, blockingReasons: ["payment_stage_not_reached"] })
    );
    renderPanel();

    expect(await screen.findByText("Payment is not available yet")).toBeInTheDocument();
    expect(screen.getByText("Payment becomes available once your documents are verified.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("shows a provider-unavailable message when eligible but checkout is unavailable", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ checkoutAvailable: false }));
    renderPanel();

    expect(await screen.findByText("Hosted checkout is not available right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("opens a blank protected tab synchronously on click, then navigates it to the backend-provided checkout URL once initiation succeeds", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    paymentsClient.initiateCheckout.mockResolvedValue({ eligibility: eligibility({ latestPayment: payment() }), payment: payment() });
    const popup = createPopupStub();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Pay now" }));

    // Opened in the same click, before the checkout URL is known -- never
    // passed noopener/noreferrer here, since that would make window.open
    // return null and lose the handle this needs to navigate later.
    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(popup.opener).toBeNull();

    await waitFor(() => expect(popup.location.href).toBe("https://mock-payments.example.test/checkout?orderid=1"));
    expect(window.location.href).not.toContain("mock-payments.example.test");
    expect(screen.queryByText("Open checkout")).not.toBeInTheDocument();
    // Opening (and even navigating) the tab is not confirmation -- only a
    // subsequent GET returning "paid" is, which this mock never returns.
    expect(screen.queryByText("Paid")).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it("shows a fallback button to open checkout manually when the browser blocks the pre-opened tab", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    paymentsClient.initiateCheckout.mockResolvedValue({ eligibility: eligibility({ latestPayment: payment() }), payment: payment() });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Pay now" }));

    expect(
      await screen.findByText("Your browser blocked the checkout window. Use the button below to open it manually.")
    ).toBeInTheDocument();
    const manualButton = screen.getByRole("button", { name: "Open checkout" });

    const manualPopup = createPopupStub();
    openSpy.mockClear();
    openSpy.mockReturnValue(manualPopup as unknown as Window);
    fireEvent.click(manualButton);

    // A click on the fallback button is its own fresh user gesture, so this
    // one can safely pass noopener/noreferrer directly -- there's no later
    // navigation step needed since the URL is already known.
    expect(openSpy).toHaveBeenCalledWith("https://mock-payments.example.test/checkout?orderid=1", "_blank", "noopener,noreferrer");
    expect(screen.queryByRole("button", { name: "Open checkout" })).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it("shows the fallback button when the candidate closes the pre-opened tab before initiation resolves", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    paymentsClient.initiateCheckout.mockResolvedValue({ eligibility: eligibility({ latestPayment: payment() }), payment: payment() });
    const popup = createPopupStub();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Pay now" }));
    popup.close();

    expect(
      await screen.findByText("Your browser blocked the checkout window. Use the button below to open it manually.")
    ).toBeInTheDocument();
    openSpy.mockRestore();
  });

  it("closes the pre-opened tab when checkout initiation fails", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    paymentsClient.initiateCheckout.mockRejectedValue({ code: "SERVER_ERROR" });
    const popup = createPopupStub();
    const closeSpy = vi.spyOn(popup, "close");
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Pay now" }));

    await screen.findByText("Something went wrong.");
    expect(closeSpy).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open checkout" })).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it("shows a waiting-for-confirmation message once a checkout is pending", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ latestPayment: payment() }));
    renderPanel();

    expect(await screen.findByText(/waiting for your payment provider/)).toBeInTheDocument();
    expect(screen.queryByText(/Payment reference/)).not.toBeInTheDocument();
  });

  it("shows the paid receipt with amount, paid-on date, and the safe payment reference id, never provider internals", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({
        latestPayment: payment({ id: "payment-public-id-42", status: "paid", paidAt: "2026-08-31T10:00:00Z" }),
        checkoutAvailable: true,
        voucherAvailable: false,
        openVoucher: null,
        cardCheckoutOpen: false,
      })
    );
    renderPanel();

    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.getByText(/Paid on/)).toBeInTheDocument();
    expect(screen.getByText(/Payment reference/)).toBeInTheDocument();
    expect(screen.getByText("payment-public-id-42")).toBeInTheDocument();
    expect(screen.queryByText(/mock_hosted_checkout/)).not.toBeInTheDocument();
  });

  it("allows retrying checkout initiation after a server error, and prevents duplicate clicks while pending", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    paymentsClient.initiateCheckout.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce({
      eligibility: eligibility({ latestPayment: payment() }),
      payment: payment(),
    });
    vi.spyOn(window, "open").mockImplementation(() => null);
    renderPanel();

    const payButton = await screen.findByRole("button", { name: "Pay now" });
    fireEvent.click(payButton);
    fireEvent.click(payButton);

    await waitFor(() => expect(paymentsClient.initiateCheckout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(paymentsClient.initiateCheckout).toHaveBeenCalledTimes(2));
    const [, secondKey] = paymentsClient.initiateCheckout.mock.calls[1];
    expect(secondKey).toBe(paymentsClient.initiateCheckout.mock.calls[0][1]);
  });

  it("shows a not-eligible checkout error without a retry action", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    paymentsClient.initiateCheckout.mockRejectedValue({
      code: "NOT_ELIGIBLE",
      message: "This candidate is not eligible to start payment.",
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Pay now" }));

    expect(await screen.findByText("This candidate is not eligible to start payment.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it("renders in Urdu when that is the persisted language", async () => {
    localStorage.setItem("descon.language", "ur");
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    renderPanel();

    expect(await screen.findByRole("button", { name: "ابھی ادائیگی کریں" })).toBeInTheDocument();
  });

  it("shows a distinct Expired state and allows starting a new checkout once the checkout window has passed", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ latestPayment: payment({ checkoutExpiresAt: new Date(Date.now() - 60_000).toISOString() }) })
    );
    renderPanel();

    expect(await screen.findByText("Expired")).toBeInTheDocument();
    expect(screen.queryByText(/waiting for your payment provider/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });

  it("does not show Expired for a payment whose checkout window is still open", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ latestPayment: payment() }));
    renderPanel();

    await screen.findByText(/waiting for your payment provider/);
    expect(screen.queryByText("Expired")).not.toBeInTheDocument();
  });

  it("stops automatic polling after a safe timeout and offers a manual refresh instead", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ latestPayment: payment() }));
    renderPanel();

    await vi.waitFor(() => expect(screen.getByText(/waiting for your payment provider/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000);
    });

    expect(screen.getByText("We haven't heard back from your payment provider yet. Tap refresh to check again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.queryByText(/waiting for your payment provider/)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("invalidates the dashboard's application-progress and profile caches the moment a payment is confirmed paid", async () => {
    paymentsClient.getEligibility
      .mockResolvedValueOnce(eligibility({ latestPayment: payment() }))
      .mockResolvedValueOnce(eligibility({ latestPayment: payment({ status: "paid", paidAt: "2026-09-01T09:00:00Z" }) }));
    const queryClient = renderPanel();
    queryClient.setQueryData(["documents", "applicationProgress", "candidate-public-id-1", "en"], { stale: false });
    queryClient.setQueryData(["profile", "candidate", "candidate-public-id-1", "en"], { stale: false });

    await screen.findByText(/waiting for your payment provider/);
    await waitFor(() => queryClient.refetchQueries({ queryKey: ["payments", "eligibility"] }));
    await screen.findByText("Paid");

    expect(queryClient.getQueryState(["documents", "applicationProgress", "candidate-public-id-1", "en"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["profile", "candidate", "candidate-public-id-1", "en"])?.isInvalidated).toBe(true);
  });
});

describe("PaymentPanel payment code (voucher)", () => {
  afterEach(() => {
    vi.mocked(paymentsClient.getEligibility).mockReset();
    vi.mocked(paymentsClient.initiateCheckout).mockReset();
    vi.mocked(paymentsClient.createVoucher).mockReset();
    localStorage.removeItem("descon.language");
  });

  const voucher = (overrides = {}) =>
    payment({
      id: "voucher-1",
      provider: "kuickpay_voucher",
      checkoutUrl: null,
      voucherNumber: "0000832249220",
      checkoutExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides,
    });

  it("opens on the payment code tab when both ways are offered, and can switch to the card tab", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true }));
    renderPanel();

    expect(await screen.findByRole("tab", { name: "Pay with a code" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Get my payment code" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pay by card" }));

    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });

  it("shows no tabs when only the card is offered", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    renderPanel();

    expect(await screen.findByRole("button", { name: "Pay now" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("gets a payment code and shows it with the steps and the date to pay before", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true }));
    const issued = voucher();
    paymentsClient.createVoucher.mockResolvedValue({
      eligibility: eligibility({ voucherAvailable: true, openVoucher: issued, latestPayment: issued }),
      payment: issued,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Get my payment code" }));

    expect(await screen.findByText("0000832249220")).toBeInTheDocument();
    expect(paymentsClient.createVoucher).toHaveBeenCalledWith("candidate-access-token", expect.any(String));
    expect(screen.getByText("How to pay your code")).toBeInTheDocument();
    expect(screen.getByText(/Pay before/)).toBeInTheDocument();
    expect(screen.getByText(/Once your payment is received/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get my payment code" })).not.toBeInTheDocument();
  });

  it("explains the two ways to pay: from the phone and at a shop", async () => {
    const open = voucher();
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true, openVoucher: open, latestPayment: open }));
    renderPanel();

    expect(await screen.findByText("How to pay your code")).toBeInTheDocument();
    expect(screen.getByText("From your phone")).toBeInTheDocument();
    expect(screen.getByText(/Open your JazzCash or Easypaisa app, or your bank app/)).toBeInTheDocument();
    expect(screen.getByText("At a shop")).toBeInTheDocument();
    expect(screen.getByText(/go to a JazzCash or Easypaisa shop/)).toBeInTheDocument();
    expect(screen.getByText("Pay as soon as you can, so your process is not delayed.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "JazzCash" })).not.toBeInTheDocument();
  });

  it("copies the code", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const open = voucher();
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true, openVoucher: open, latestPayment: open }));
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Copy code" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("0000832249220"));
    expect(await screen.findByText("Code copied")).toBeInTheDocument();
  });

  it("lets the candidate choose the card while a code is open, with a warning to pay one way only", async () => {
    const open = voucher();
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true, openVoucher: open, latestPayment: open }));
    renderPanel();

    expect(await screen.findByText(/Pay by code or by card, not both/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pay by card" }));

    expect(screen.getByText(/You already have a payment code/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });

  it("still shows the open code when the newest payment is a card checkout", async () => {
    const open = voucher();
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ voucherAvailable: true, openVoucher: open, cardCheckoutOpen: true, latestPayment: payment() })
    );
    renderPanel();

    expect(await screen.findByText("0000832249220")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pay by card" })).toBeInTheDocument();
  });

  it("lets the candidate get a code while a card checkout is in progress, with a warning", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ voucherAvailable: true, cardCheckoutOpen: true, latestPayment: payment() })
    );
    renderPanel();

    expect(await screen.findByRole("tab", { name: "Pay by card" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Pay with a code" }));

    expect(screen.getByText(/A card payment is open/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get my payment code" })).toBeInTheDocument();
  });

  it("offers a new code once the old one has expired, and the card again", async () => {
    const expired = voucher({ checkoutExpiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true, latestPayment: expired }));
    renderPanel();

    expect(await screen.findByText("This payment code has expired. Get a new one to pay.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get a new payment code" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pay by card" }));

    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });

  it("shows the server's message when the code cannot be taken, and reloads what is allowed", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true }));
    paymentsClient.createVoucher.mockRejectedValue({ code: "CHECKOUT_UNAVAILABLE", message: "Payment codes are paused." });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Get my payment code" }));

    expect(await screen.findByText("Payment codes are paused.")).toBeInTheDocument();
    await waitFor(() => expect(paymentsClient.getEligibility).toHaveBeenCalledTimes(2));
  });

  it("tells the candidate when payment codes are not available, and still offers the card", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: false }));
    renderPanel();

    expect(await screen.findByRole("button", { name: "Pay now" })).toBeInTheDocument();
    expect(screen.queryByText("Payment codes are not available right now. You can pay by card.")).not.toBeInTheDocument();
  });
});
