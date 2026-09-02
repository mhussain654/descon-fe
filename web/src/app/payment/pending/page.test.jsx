import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import PaymentPendingPage from "./page";

// Deliberately no AuthProvider/QueryClientProvider/mocked API client here --
// this page must render standalone, with no authentication and no API
// calls, since the tab that lands on it after the hosted-checkout redirect
// has no candidate session at all (see page.jsx's own comment).
describe("PaymentPendingPage", () => {
  it("renders without requiring authentication or calling any API", () => {
    render(
      <LanguageProvider>
        <PaymentPendingPage />
      </LanguageProvider>
    );

    expect(screen.getByText("Payment confirmation pending")).toBeInTheDocument();
    expect(
      screen.getByText("Your payment provider is processing the payment. Return to Descon to check the confirmed status.")
    ).toBeInTheDocument();
  });

  it("never implies the payment has succeeded -- the callback may still be pending", () => {
    render(
      <LanguageProvider>
        <PaymentPendingPage />
      </LanguageProvider>
    );

    expect(screen.queryByText(/all set/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confirmed/i, { selector: "h1" })).not.toBeInTheDocument();
  });

  it("renders in Urdu when that is the persisted language", () => {
    localStorage.setItem("descon.language", "ur");
    render(
      <LanguageProvider>
        <PaymentPendingPage />
      </LanguageProvider>
    );

    expect(screen.getByText("ادائیگی کی تصدیق زیر التواء ہے")).toBeInTheDocument();
    localStorage.removeItem("descon.language");
  });
});
