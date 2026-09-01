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

    expect(screen.getByText("You're all set")).toBeInTheDocument();
    expect(screen.getByText(/close this tab and return to the Descon app/)).toBeInTheDocument();
  });

  it("renders in Urdu when that is the persisted language", () => {
    localStorage.setItem("descon.language", "ur");
    render(
      <LanguageProvider>
        <PaymentPendingPage />
      </LanguageProvider>
    );

    expect(screen.getByText("آپ کا کام مکمل ہو گیا")).toBeInTheDocument();
    localStorage.removeItem("descon.language");
  });
});
