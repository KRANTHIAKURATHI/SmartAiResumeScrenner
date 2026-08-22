import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("starts light, flips the dark class on click and persists the choice", async () => {
    render(<ThemeToggle />);
    const button = await screen.findByRole("button", { name: "Switch to dark mode" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await userEvent.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("srs-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("srs-theme")).toBe("light");
  });

  it("restores a stored dark preference on mount", async () => {
    localStorage.setItem("srs-theme", "dark");
    render(<ThemeToggle />);
    await screen.findByRole("button", { name: "Switch to light mode" });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("hides the text label in icon-only mode but keeps an accessible name", async () => {
    render(<ThemeToggle iconOnly />);
    const button = await screen.findByRole("button", { name: "Switch to dark mode" });
    expect(button.textContent).toBe("");
  });
});
