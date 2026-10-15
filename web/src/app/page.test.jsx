import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("site root", () => {
  it("sends visitors straight to the staff admin sign-in", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin/login" element={<p>Staff admin sign-in page</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Staff admin sign-in page")).toBeInTheDocument();
  });
});
