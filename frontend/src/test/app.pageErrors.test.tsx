import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { makeState } from "./fakeApi";
import { renderApp } from "./renderApp";

// Stands in for a page with a rendering bug. Only this file sees the mock.
vi.mock("@/pages/calendar/CalendarPage", () => ({
  CalendarPage: () => {
    throw new Error("Cannot read properties of undefined (reading 'date')");
  },
}));

afterEach(() => vi.restoreAllMocks());

describe("Pages that can't be shown", () => {
  it("says the page wasn't found for an unknown address, with a way back", async () => {
    const { user } = renderApp("/launches", makeState());

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Go to portfolio" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
  });

  it("shows a crashed page's error inside the shell, so navigation keeps working", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { user } = renderApp("/calendar", makeState());

    expect(await screen.findByText("This page couldn't be displayed")).toBeInTheDocument();
    expect(screen.getByText("Cannot read properties of undefined (reading 'date')")).toBeInTheDocument();

    await user.click(within(screen.getByRole("navigation", { name: "Workspace" })).getByRole("link", { name: "Library" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
  });
});
