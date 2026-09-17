import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { handlers, makeState } from "@/test/fakeApi";
import { server } from "@/test/server";
import { App } from "./App";

describe("App", () => {
  // renderApp mirrors App's providers for page tests; this checks the real composition and browser router.
  it("opens on sign-in for a signed-out visitor, then signing in lands on the portfolio", async () => {
    server.use(...handlers(makeState()));
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Email"), "jordan@northstar.example");
    expect(window.location.pathname).toBe("/login");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/portfolio");
  });
});
