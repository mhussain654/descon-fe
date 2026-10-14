import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "../contexts/LanguageContext";
import HomePage from "./page";

describe("Descon Connect home", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("dir");
    document.documentElement.removeAttribute("lang");
  });

  it("shows the public introduction, staff access and honest mobile availability", () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <HomePage />
        </LanguageProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /your journey with descon/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Staff login" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Staff login" })[0]).toHaveAttribute("href", "/admin/login");
    expect(screen.getByText("Mobile app coming soon")).toBeInTheDocument();
    expect(screen.queryByLabelText(/cnic/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/select your preferred language/i)).not.toBeInTheDocument();
  });
});
