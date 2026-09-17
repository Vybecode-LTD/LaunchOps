import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { ActivityEntry } from "@/lib/api/types";
import { makeProject, makeState, type FakeInvitation, type FakeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";

const HARBOR = { id: "org-2", name: "Harbor Labs", role: "editor" as const };

function twoOrganisations(partial: Partial<FakeState> = {}): FakeState {
  const state = makeState({
    projects: [makeProject({ name: "Northstar Radar", org_id: "org-1" }), makeProject({ name: "Harbor Pilot", org_id: "org-2" })],
    ...partial,
  });
  state.user = { ...state.user, organisations: [...state.user.organisations, HARBOR] };
  state.members.push(
    { org_id: "org-2", user_id: "user-9", name: "Hana Ito", email: "hana@harbor.example", role: "owner", joined_at: "2026-08-01T00:00:00+00:00" },
    { org_id: "org-2", user_id: "user-1", name: "Jordan Avery", email: "jordan@northstar.example", role: "editor", joined_at: "2026-09-03T00:00:00+00:00" },
  );
  return state;
}

function invitation(overrides: Partial<FakeInvitation> = {}): FakeInvitation {
  return {
    id: "invitation-1",
    org_id: "org-3",
    organisation: "Lumen Studio",
    email: "jordan@northstar.example",
    role: "approver",
    invited_by: "Priya Shah",
    token: "invite-token-0123456789abcdefghijklmnopqrstuv",
    status: "pending",
    created_at: "2026-09-10T09:00:00+00:00",
    expires_at: "2026-09-17T09:00:00+00:00",
    ...overrides,
  };
}

function activityEntry(n: number): ActivityEntry & { org_id: string } {
  return {
    id: n,
    org_id: "org-1",
    actor: "jordan@northstar.example",
    action: "project.created",
    target_type: "project",
    target_id: `project-${n}`,
    summary: `Created the project Venture ${n}`,
    details: {},
    created_at: new Date(Date.UTC(2026, 8, 1, 0, n)).toISOString(),
  };
}

describe("Organisation switcher", () => {
  it("shows the organisation and role, and switching shows that organisation's projects", async () => {
    const state = twoOrganisations();
    const { user, router } = renderApp("/portfolio", state);

    const switcher = await screen.findByRole("button", { name: "Organisation: Northstar Ventures, your role: Owner. Switch organisation" });
    const railProjects = () => screen.getByRole("navigation", { name: "Projects" });
    expect(await within(railProjects()).findByRole("link", { name: "Northstar Radar" })).toBeInTheDocument();
    expect(requestsTo(state, "GET", "/api/products").length).toBeGreaterThan(0);

    await user.click(switcher);
    await user.click(await screen.findByRole("menuitem", { name: /Harbor Labs/ }));

    expect(await screen.findByRole("button", { name: "Organisation: Harbor Labs, your role: Editor. Switch organisation" })).toBeInTheDocument();
    expect(await within(railProjects()).findByRole("link", { name: "Harbor Pilot" })).toBeInTheDocument();
    expect(within(railProjects()).queryByRole("link", { name: "Northstar Radar" })).not.toBeInTheDocument();
    expect(localStorage.getItem("launchops_org")).toBe("org-2");
    expect(router.state.location.pathname).toBe("/portfolio");
  });

  it("works in the user's first organisation when the one remembered is no longer theirs", async () => {
    localStorage.setItem("launchops_org", "org-removed");
    const state = twoOrganisations();
    renderApp("/portfolio", state);

    expect(await screen.findByRole("button", { name: /^Organisation: Northstar Ventures/ })).toBeInTheDocument();
    const railProjects = screen.getByRole("navigation", { name: "Projects" });
    expect(await within(railProjects).findByRole("link", { name: "Northstar Radar" })).toBeInTheDocument();
    expect(within(railProjects).queryByRole("link", { name: "Harbor Pilot" })).not.toBeInTheDocument();
    expect(localStorage.getItem("launchops_org")).toBe("org-1");
  });
});

describe("Organisation settings", () => {
  it("lets an owner rename the organisation", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/organisation", state);

    const panel = await screen.findByRole("region", { name: "Organisation" });
    const name = within(panel).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Northstar Capital");
    await user.click(within(panel).getByRole("button", { name: "Save name" }));

    expect(await screen.findByRole("button", { name: /^Organisation: Northstar Capital/ })).toBeInTheDocument();
    expect(requestsTo(state, "PATCH", "/api/organisation")[0]?.body).toEqual({ name: "Northstar Capital" });
  });

  it("lists members, and lets an owner change a role or remove someone", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/organisation", state);

    const members = await screen.findByRole("region", { name: "Members" });
    expect(await within(members).findByText("sam@northstar.example")).toBeInTheDocument();
    await user.selectOptions(within(members).getByLabelText("Role for sam@northstar.example"), "approver");
    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/organisation/members/user-2")[0]?.body).toEqual({ role: "approver" }));
    expect(await screen.findByText("Sam Rivera is now an Approver")).toBeInTheDocument();

    await user.click(within(members).getByRole("button", { name: "Remove sam@northstar.example" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Remove sam@northstar.example?" });
    await user.click(within(dialog).getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(within(members).queryByText("sam@northstar.example")).not.toBeInTheDocument());
  });

  it("explains why the last owner can't step down", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/organisation", state);

    const members = await screen.findByRole("region", { name: "Members" });
    await user.selectOptions(await within(members).findByLabelText("Role for jordan@northstar.example"), "editor");

    expect(await screen.findByText("An organisation needs at least one owner. Make someone else an owner first.")).toBeInTheDocument();
  });

  it("creates an invitation link to share, lists it, and withdraws it", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/organisation", state);

    const invite = await screen.findByRole("region", { name: "Invite someone" });
    await user.type(within(invite).getByLabelText("Email"), "Priya@Lumen.example");
    await user.selectOptions(within(invite).getByLabelText("Role"), "viewer");
    await user.click(within(invite).getByRole("button", { name: "Create invitation" }));

    const status = await within(invite).findByRole("status");
    expect(status).toHaveTextContent("Send priya@lumen.example this link to join Northstar Ventures as a Viewer.");
    const [created] = state.invitations;
    expect(status).toHaveTextContent(`${window.location.origin}/invite/${created!.token}`);
    expect(within(status).getByRole("button", { name: "Copy link" })).toBeInTheDocument();

    const pending = await screen.findByRole("region", { name: "Waiting to be accepted" });
    expect(within(pending).getByText("priya@lumen.example")).toBeInTheDocument();
    await user.click(within(pending).getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Waiting to be accepted" })).not.toBeInTheDocument());
    expect(state.invitations[0]?.status).toBe("revoked");
  });

  it("shows other members the organisation without the owner's controls", async () => {
    const state = twoOrganisations();
    localStorage.setItem("launchops_org", "org-2");
    renderApp("/settings/organisation", state);

    const panel = await screen.findByRole("region", { name: "Organisation" });
    expect(within(panel).getByText("Harbor Labs")).toBeInTheDocument();
    expect(within(panel).getByText(/^Editor\. Also creates and edits projects/)).toBeInTheDocument();
    const members = screen.getByRole("region", { name: "Members" });
    expect(await within(members).findByText("hana@harbor.example")).toBeInTheDocument();
    expect(within(members).queryByLabelText("Role for hana@harbor.example")).not.toBeInTheDocument();
    expect(within(members).queryByRole("button", { name: "Remove hana@harbor.example" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Invite someone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Activity" })).not.toBeInTheDocument();
    expect(requestsTo(state, "GET", "/api/organisation/invitations")).toEqual([]);
  });

  it("lets a member leave, then works in their remaining organisation", async () => {
    const state = twoOrganisations();
    localStorage.setItem("launchops_org", "org-2");
    const { user, router } = renderApp("/settings/organisation", state);

    const members = await screen.findByRole("region", { name: "Members" });
    await user.click(await within(members).findByRole("button", { name: "Leave" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave Harbor Labs?" });
    await user.click(within(dialog).getByRole("button", { name: "Leave organisation" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/portfolio"));
    expect(await screen.findByRole("button", { name: /^Organisation: Northstar Ventures/ })).toBeInTheDocument();
    expect(localStorage.getItem("launchops_org")).toBe("org-1");
  });

  it("sends a member who opens Activity to the organisation page", async () => {
    const state = twoOrganisations();
    localStorage.setItem("launchops_org", "org-2");
    const { router } = renderApp("/settings/activity", state);

    await waitFor(() => expect(router.state.location.pathname).toBe("/settings/organisation"));
  });
});

describe("Activity", () => {
  it("shows owners who did what, newest first, and loads older entries", async () => {
    const entries = Array.from({ length: 51 }, (_, i) => activityEntry(51 - i));
    const state = makeState({ activity: entries });
    const { user } = renderApp("/settings/activity", state);

    const panel = await screen.findByRole("region", { name: "Activity" });
    expect(await within(panel).findByText("Created the project Venture 51")).toBeInTheDocument();
    expect(within(panel).queryByText("Created the project Venture 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show older activity" }));

    expect(await within(panel).findByText("Created the project Venture 1")).toBeInTheDocument();
    expect(requestsTo(state, "GET", "/api/organisation/activity?limit=50&before=2")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Show older activity" })).not.toBeInTheDocument();
  });

  it("says when nothing has been recorded", async () => {
    renderApp("/settings/activity", makeState());
    expect(await screen.findByText("Nothing recorded yet")).toBeInTheDocument();
  });
});

describe("Invitation links", () => {
  it("lets a signed-in user with the invited address join, and switches to the organisation", async () => {
    const state = makeState({ invitations: [invitation()] });
    const { user, router } = renderApp(`/invite/${invitation().token}`, state);

    expect(await screen.findByRole("heading", { name: "Join Lumen Studio" })).toBeInTheDocument();
    expect(screen.getByText(/Priya Shah invited you to join as an Approver\. The invitation is for jordan@northstar\.example/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join Lumen Studio" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/portfolio"));
    expect(await screen.findByRole("button", { name: "Organisation: Lumen Studio, your role: Approver. Switch organisation" })).toBeInTheDocument();
    expect(localStorage.getItem("launchops_org")).toBe("org-3");
  });

  it("creates an account for someone new, straight into the organisation", async () => {
    const newcomer = invitation({ email: "priya@lumen.example", role: "viewer" });
    const state = makeState({ invitations: [newcomer] });
    const { user, router } = renderApp(`/invite/${newcomer.token}`, state, { signedIn: false });

    expect(await screen.findByLabelText("Email")).toHaveValue("priya@lumen.example");
    await user.type(screen.getByLabelText("Name"), "Priya Shah");
    await user.type(screen.getByLabelText("Password"), "a-long-password");
    await user.click(screen.getByRole("button", { name: "Create account and join Lumen Studio" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/portfolio"));
    expect(await screen.findByRole("button", { name: "Organisation: Lumen Studio, your role: Viewer. Switch organisation" })).toBeInTheDocument();
    expect(requestsTo(state, "POST", `/api/invitations/${newcomer.token}/register`)[0]?.body).toEqual({
      name: "Priya Shah",
      password: "a-long-password",
    });
  });

  it("sends someone who already has an account to sign in first", async () => {
    const existing = invitation({ email: "sam@northstar.example" });
    const state = makeState({ invitations: [existing] });
    renderApp(`/invite/${existing.token}`, state, { signedIn: false });

    expect(await screen.findByText("sam@northstar.example already has a LaunchOps account. Sign in with it to accept.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to accept" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(`/invite/${existing.token}`)}`,
    );
  });

  it("tells a user signed in with another address to switch accounts", async () => {
    const other = invitation({ email: "priya@lumen.example" });
    const state = makeState({ invitations: [other] });
    const { user } = renderApp(`/invite/${other.token}`, state);

    expect(
      await screen.findByText("You're signed in as jordan@northstar.example. Sign out, then sign in as priya@lumen.example to accept."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
  });

  it("explains an invitation that no longer works", async () => {
    renderApp("/invite/expired-token", makeState(), { signedIn: false });

    expect(await screen.findByRole("heading", { name: "Invitation unavailable" })).toBeInTheDocument();
    expect(screen.getByText("This invitation has expired, was withdrawn or has been used. Ask for a new one.")).toBeInTheDocument();
  });
});
