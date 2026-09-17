import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, DATABASE_OUTAGE, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

describe("Creating an account", () => {
  it("creates an account and opens the workspace signed in as the new person", async () => {
    const state = makeState();
    const { user } = renderApp("/register", state, { signedIn: false });

    await user.type(await screen.findByLabelText("Name"), "Riley Chen");
    await user.type(screen.getByLabelText("Email"), "riley@halcyon.example");
    await user.type(screen.getByLabelText("Password"), "long-enough");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Riley Chen/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Organisation: Riley Chen's organisation, your role: Owner. Switch organisation" })).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/auth/register")[0]?.body).toEqual({ name: "Riley Chen", email: "riley@halcyon.example", password: "long-enough" });
    expect(localStorage.getItem("launchops_token")).toBe("token-1");
  });

  it("explains that sign-up is closed when an administrator has turned it off", async () => {
    const { user } = renderApp("/register", makeState({ registrationEnabled: false }), { signedIn: false });

    await user.type(await screen.findByLabelText("Email"), "riley@halcyon.example");
    await user.type(screen.getByLabelText("Password"), "long-enough");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Registration is closed. Ask an administrator to create an account for you.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Create your account" })).toBeInTheDocument();
    expect(localStorage.getItem("launchops_token")).toBeNull();
  });

  it("shows the server's reason when an account can't be created", async () => {
    const { user } = renderApp("/register", makeState(), { signedIn: false });

    await user.type(await screen.findByLabelText("Email"), "sam@northstar.example");
    await user.type(screen.getByLabelText("Password"), "long-enough");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("An account with this email already exists")).toBeInTheDocument();
  });
});

describe("Signing in", () => {
  it("shows the password on request so it can be checked", async () => {
    const { user } = renderApp("/login", makeState(), { signedIn: false });

    const password = await screen.findByLabelText("Password");
    await user.type(password, "correct-horse");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});

describe("Session", () => {
  /** Signs in on the portfolio, then has the server reject the token when the Library loads. */
  async function rejectTokenOnNextPage(detail: string) {
    const state = makeState();
    const app = renderApp("/portfolio", state);
    await screen.findByRole("heading", { level: 1, name: "Portfolio" });
    server.use(http.get(`${API}/api/templates`, () => HttpResponse.json({ detail }, { status: 401 })));

    await app.user.click(within(screen.getByRole("navigation", { name: "Workspace" })).getByRole("link", { name: "Library" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    return app;
  }

  it("signs you out with an explanation when your session expires during a visit, then returns you to the page", async () => {
    const { router } = await rejectTokenOnNextPage("Invalid or expired token");

    expect(screen.getByText("Your session ended. Sign in again to continue.")).toBeInTheDocument();
    expect(localStorage.getItem("launchops_token")).toBeNull();
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe("/login?next=%2Flibrary");
  });

  it("tells someone whose account was disabled why they were signed out", async () => {
    await rejectTokenOnNextPage("Account is disabled");
    expect(screen.getByText("This account has been disabled. Contact an administrator.")).toBeInTheDocument();
  });

  it("asks you to sign in again when the saved session is no longer valid when the app opens", async () => {
    const state = makeState({ meResponse: () => HttpResponse.json({ detail: "Invalid or expired token" }, { status: 401 }) });
    const { router } = renderApp("/calendar", state);

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(localStorage.getItem("launchops_token")).toBeNull();
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe("/login?next=%2Fcalendar");
  });

  it("says when the server can't be reached as the app opens, and carries on once it's back", async () => {
    const state = makeState({ meResponse: () => HttpResponse.error() });
    const { user } = renderApp("/portfolio", state);

    expect(await screen.findByText("Can't reach the LaunchOps server. Check your connection and try again.")).toBeInTheDocument();
    expect(localStorage.getItem("launchops_token")).toBe("token-1");

    state.meResponse = undefined;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
  });

  // Regression: a 503 during a database outage signed people out, although the backend answers 503
  // rather than 401 precisely so that an outage doesn't end sessions (backend test B17).
  it("keeps you signed in when the server has a temporary problem as the app opens", async () => {
    const state = makeState({ meResponse: () => HttpResponse.json({ detail: DATABASE_OUTAGE }, { status: 503 }) });
    const { user } = renderApp("/portfolio", state);

    expect(await screen.findByText(DATABASE_OUTAGE)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    expect(localStorage.getItem("launchops_token")).toBe("token-1");

    state.meResponse = undefined;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
    await waitFor(() => expect(requestsTo(state, "GET", "/api/auth/me")).toHaveLength(2));
  });
});
