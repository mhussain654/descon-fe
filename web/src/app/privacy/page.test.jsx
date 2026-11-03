import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import PrivacyPolicyPage from "./page";
import TermsAndConditionsPage from "../terms/page";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsAndConditionsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("public legal pages", () => {
  it("shows the privacy policy without signing in, including how to delete an account", () => {
    renderAt("/privacy");

    expect(screen.getByRole("heading", { level: 1, name: "MPS Connect Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText("30 October 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "7. Your rights and deleting your account" })).toBeInTheDocument();
    expect(screen.getByText(/with the subject "Delete my MPS Connect account"/)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Provider" })).toBeInTheDocument();
    expect(document.title).toBe("MPS Connect Privacy Policy");
  });

  it("shows the terms and links them to the privacy policy", () => {
    renderAt("/terms");

    expect(screen.getByRole("heading", { level: 1, name: "MPS Connect Terms and Conditions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "20. Candidate acknowledgement" })).toBeInTheDocument();

    const introduction = screen.getByRole("heading", { name: "1. Introduction" }).closest("section");
    fireEvent.click(within(introduction).getByRole("link", { name: "MPS Connect Privacy Policy" }));

    expect(screen.getByRole("heading", { level: 1, name: "MPS Connect Privacy Policy" })).toBeInTheDocument();
  });
});
