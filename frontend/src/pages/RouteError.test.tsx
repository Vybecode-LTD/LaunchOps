import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { RouteError } from "./RouteError";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Opens /calendar, whose route fails as described, with RouteError as its error element. */
function openFailingPage(failure: Pick<RouteObject, "lazy" | "Component">) {
  const router = createMemoryRouter(
    [
      { path: "/calendar", errorElement: <RouteError />, ...failure } as RouteObject,
      { path: "/portfolio", element: <h1>Portfolio</h1> },
    ],
    { initialEntries: ["/calendar"] },
  );
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

describe("RouteError", () => {
  it("asks for a reload when a page's code has changed since the app was opened", async () => {
    openFailingPage({
      lazy: () => Promise.reject(new TypeError("Failed to fetch dynamically imported module: https://launchops.run/assets/CalendarPage-3f2a.js")),
    });

    expect(await screen.findByText("LaunchOps has been updated")).toBeInTheDocument();
    expect(screen.getByText("Reload to get the latest version.")).toBeInTheDocument();
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });

  it("recognises Safari's wording for the same failure", async () => {
    openFailingPage({ lazy: () => Promise.reject(new TypeError("Importing a module script failed.")) });
    expect(await screen.findByText("LaunchOps has been updated")).toBeInTheDocument();
  });

  it("explains a page that crashed and keeps the details to share with an administrator", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    openFailingPage({
      Component: () => {
        throw new Error("Cannot read properties of undefined (reading 'name')");
      },
    });

    expect(await screen.findByText("This page couldn't be displayed")).toBeInTheDocument();
    expect(screen.getByText(/If it keeps happening, share the details below/)).toBeInTheDocument();
    expect(screen.getByText("Cannot read properties of undefined (reading 'name')")).toBeInTheDocument();
  });

  it("reloads the app on request", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const { user } = openFailingPage({ lazy: () => Promise.reject(new TypeError("Importing a module script failed.")) });

    await user.click(await screen.findByRole("button", { name: "Reload" }));

    expect(reload).toHaveBeenCalledOnce();
  });

  it("offers a way back to the portfolio", async () => {
    const { user, router } = openFailingPage({ lazy: () => Promise.reject(new TypeError("Importing a module script failed.")) });

    await user.click(await screen.findByRole("link", { name: "Go to portfolio" }));

    expect(await screen.findByRole("heading", { name: "Portfolio" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/portfolio");
  });
});
