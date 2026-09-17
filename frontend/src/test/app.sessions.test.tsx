import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw";
import { makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";

describe("Staying signed in", () => {
  it("renews a session that expired while the app was closed", async () => {
    let checks = 0;
    const state = makeState({
      sessionRenews: true,
      meResponse: () =>
        checks++ === 0 ? HttpResponse.json({ detail: "Invalid or expired token" }, { status: 401 }) : HttpResponse.json(state.user),
    });
    renderApp("/portfolio", state);

    expect(await screen.findByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/auth/refresh")).toHaveLength(1);
    expect(localStorage.getItem("launchops_token")).toBe("token-renewed");
  });

  it("signing out also ends the session on the server", async () => {
    const state = makeState();
    const { user } = renderApp("/portfolio", state);

    await user.click(await screen.findByRole("button", { name: /^Jordan Avery/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(requestsTo(state, "POST", "/api/auth/logout")).toHaveLength(1));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(localStorage.getItem("launchops_token")).toBeNull();
    expect(localStorage.getItem("launchops_org")).toBeNull();
  });
});

describe("Forgotten passwords", () => {
  it("links to a reset from the sign-in page and asks for the email address", async () => {
    const state = makeState();
    const { user } = renderApp("/login", state, { signedIn: false });

    await user.click(await screen.findByRole("link", { name: "Forgot your password?" }));
    // The page loads lazily: until it arrives, the sign-in form (with its own Email field) stays on screen.
    expect(await screen.findByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "jordan@northstar.example");
    await user.click(screen.getByRole("button", { name: "Email me a reset link" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText(/If jordan@northstar\.example has a LaunchOps account, we've sent it a link/)).toBeInTheDocument();
    expect(screen.getByText(/ask your LaunchOps administrator for a reset link/)).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/auth/password-reset")[0]?.body).toEqual({ email: "jordan@northstar.example" });
  });

  it("sets a new password from a reset link and carries on signed in", async () => {
    const state = makeState({ passwordResets: { "reset-token-1": "jordan@northstar.example" } });
    const { user, router } = renderApp("/reset-password/reset-token-1", state, { signedIn: false });

    expect(await screen.findByText("For jordan@northstar.example. You'll be signed out everywhere else.")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save password and sign in" });
    await user.type(screen.getByLabelText("New password"), "short");
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("New password"), "-but-longer");
    await user.click(save);

    await waitFor(() => expect(router.state.location.pathname).toBe("/portfolio"));
    expect(requestsTo(state, "POST", "/api/auth/password-reset/reset-token-1")[0]?.body).toEqual({ password: "short-but-longer" });
    expect(localStorage.getItem("launchops_token")).toBe("token-after-reset");
  });

  it("explains a reset link that no longer works and offers a new one", async () => {
    renderApp("/reset-password/used-token", makeState(), { signedIn: false });

    expect(await screen.findByRole("heading", { name: "Reset link unavailable" })).toBeInTheDocument();
    expect(screen.getByText("This reset link has expired or has already been used. Ask for a new one.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get a new reset link" })).toHaveAttribute("href", "/forgot-password");
  });
});

describe("Administrators", () => {
  it("create a one-time password reset link for someone", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/team", state);

    await user.click(await screen.findByRole("button", { name: "Create a password reset link for sam@northstar.example" }));

    const dialog = await screen.findByRole("dialog", { name: "Password reset link for sam@northstar.example" });
    const token = Object.keys(state.passwordResets ?? {})[0];
    expect(within(dialog).getByText(`${window.location.origin}/reset-password/${token}`)).toBeInTheDocument();
    expect(within(dialog).getByText(/It works once, until .+, and creating another one stops this one working\./)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });
});

describe("Invitations by email", () => {
  it("says the invitation was emailed when a mail server is set up", async () => {
    const state = makeState({ mailConfigured: true });
    const { user } = renderApp("/settings/organisation", state);

    const invite = await screen.findByRole("region", { name: "Invite someone" });
    await user.type(within(invite).getByLabelText("Email"), "priya@lumen.example");
    await user.click(within(invite).getByRole("button", { name: "Create invitation" }));

    expect(await within(invite).findByRole("status")).toHaveTextContent(
      "We emailed priya@lumen.example an invitation to join Northstar Ventures as an Editor. You can also send them this link.",
    );
  });

  it("says LaunchOps couldn't email it without a mail server", async () => {
    const { user } = renderApp("/settings/organisation", makeState());

    const invite = await screen.findByRole("region", { name: "Invite someone" });
    await user.type(within(invite).getByLabelText("Email"), "priya@lumen.example");
    await user.click(within(invite).getByRole("button", { name: "Create invitation" }));

    expect(await within(invite).findByRole("status")).toHaveTextContent("LaunchOps can't email it because no mail server is set up.");
  });
});
