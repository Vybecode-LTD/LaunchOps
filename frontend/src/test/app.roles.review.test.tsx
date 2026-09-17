import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { EmailItem, Project, QueueItem } from "@/lib/api/types";
import { id, makeProject } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { changesRequested, stateAs } from "./roles";

// What each organisation role can do with results in Review and email in the Outbox (docs/PHASE1_DESIGN.md, D2).

function queueItem(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: id("queue"),
    product_id: "",
    workflow_id: "social_posts",
    status: "pending",
    content: {},
    preview: "",
    input_params: "",
    notes: "",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const blog = { title: "Why producers build their own plugins", full_content: "Body text" };

/** A project whose email server is set up (its password is saved separately, in FakeState.smtpPasswords). */
function sendingProject(overrides: Partial<Project> = {}): Project {
  return makeProject({ email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_user: "launch@vybecod.example" }, ...overrides });
}

function draft(productId: string, overrides: Partial<EmailItem> = {}): EmailItem {
  return {
    id: id("email"),
    product_id: productId,
    source_queue_id: null,
    recipient_name: "Dana Whitfield",
    recipient_email: "dana@synthweekly.example",
    subject: "A plugin you could build in an afternoon",
    body: "Hi Dana",
    status: "pending",
    error: "",
    sent_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const row = (address: string) => screen.getByRole("row", { name: new RegExp(address.replace(/\./g, "\\.")) });

type User = ReturnType<typeof renderApp>["user"];

async function openExportMenu(user: User) {
  await user.click(await screen.findByRole("button", { name: /Export/ }));
  return screen.findByRole("menu");
}

describe("Review by role", () => {
  it("lets a viewer read and export a result, but not approve, reject, delete or save it as a template", async () => {
    const project = makeProject();
    const item = queueItem({
      product_id: project.id,
      workflow_id: "cold_outreach",
      content: { emails: [{ subject: "A plugin you could build", body: "Hi Dana", target_type: "Journalist" }] },
    });
    const state = stateAs("viewer", { projects: [project], queue: [item] });
    const { user } = renderApp(`/projects/${project.id}/review/${item.id}`, state);

    expect(await screen.findByText("A plugin you could build")).toBeInTheDocument();
    expect(screen.getByText("Approving or rejecting results needs the Approver role in Northstar Ventures.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete result" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Approving copies any email addresses/)).not.toBeInTheDocument();

    const menu = await openExportMenu(user);
    expect(within(menu).getByRole("menuitem", { name: "Copy as Markdown" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Save as template" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(changesRequested(state)).toEqual([]);
  });

  it("offers a viewer nothing to do with a reviewed result, and says running a failed one again needs the Editor role", async () => {
    const project = makeProject();
    const approved = queueItem({ product_id: project.id, workflow_id: "blog", status: "approved", content: blog });
    const failed = queueItem({ product_id: project.id, workflow_id: "trend", status: "failed", content: { error: "Claude API error 529: overloaded" } });
    const state = stateAs("viewer", { projects: [project], queue: [approved, failed] });
    const { user } = renderApp(`/projects/${project.id}/review/${approved.id}?status=all`, state);

    expect(await screen.findByRole("heading", { level: 2, name: /^Blog post draft/ })).toHaveTextContent("Approved");
    expect(screen.queryByRole("button", { name: "Move back to review" })).not.toBeInTheDocument();
    expect(screen.queryByText(/needs the Approver role/)).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("list", { name: "Results" })).getByRole("link", { name: /Trend report/ }));
    expect(await screen.findByText("This operation failed: Claude API error 529: overloaded")).toBeInTheDocument();
    expect(screen.getByText("Running it again needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete result" })).not.toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor save a result as a template and run a failed one again, but not approve or delete", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const pending = queueItem({ product_id: project.id, workflow_id: "blog", content: blog });
    const failed = queueItem({ product_id: project.id, workflow_id: "trend", status: "failed", input_params: "Focus on Europe", content: { error: "Overloaded" } });
    const state = stateAs("editor", { projects: [project], queue: [pending, failed] });
    const { user } = renderApp(`/projects/${project.id}/review/${pending.id}?status=all`, state);

    expect(await screen.findByText("Approving or rejecting results needs the Approver role in Northstar Ventures.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete result" })).not.toBeInTheDocument();
    const menu = await openExportMenu(user);
    await user.click(within(menu).getByRole("menuitem", { name: "Save as template" }));
    expect(await screen.findByText("Saved to templates")).toBeInTheDocument();
    expect(state.templates.map((t) => t.name)).toEqual(["Blog post draft — Halcyon Studio"]);

    await user.click(within(screen.getByRole("list", { name: "Results" })).getByRole("link", { name: /Trend report/ }));
    await user.click(await screen.findByRole("button", { name: "Run again" }));
    expect(await screen.findByText("Trend report started again")).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/workflows/launch")[0]?.body).toEqual({ product_id: project.id, workflow_id: "trend", instructions: "Focus on Europe" });
    expect(screen.queryByRole("button", { name: "Delete result" })).not.toBeInTheDocument();
  });

  it("lets an approver approve, move back and delete results", async () => {
    const project = makeProject();
    const item = queueItem({ product_id: project.id, workflow_id: "blog", content: blog });
    const state = stateAs("approver", { projects: [project], queue: [item] });
    const { user } = renderApp(`/projects/${project.id}/review/${item.id}`, state);

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Result approved")).toBeInTheDocument();
    expect(state.queue[0]?.status).toBe("approved");
    expect(await screen.findByRole("button", { name: "Move back to review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete result" })).toBeInTheDocument();
    expect(screen.queryByText(/needs the Approver role/)).not.toBeInTheDocument();
  });
});

describe("Outbox by role", () => {
  it("lets a viewer read drafts, but not edit, send or delete them", async () => {
    const project = sendingProject();
    const state = stateAs("viewer", { projects: [project], emails: [draft(project.id)], smtpPasswords: { [project.id]: "secret" } });
    const { user } = renderApp("/outbox", state);

    const email = await screen.findByRole("row", { name: /dana@synthweekly\.example/ });
    // Once the project has loaded, an approver would be offered Send here.
    expect(await within(email).findByRole("link", { name: "VybeCode DSP" })).toBeInTheDocument();
    expect(screen.getByText("Sending or deleting email needs the Approver role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(email).queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(within(email).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(email).queryByRole("button", { name: /^Delete email/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select all sendable drafts")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Select email to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sends used in the last 24 hours/)).not.toBeInTheDocument();

    await user.click(within(email).getByRole("button", { name: "View" }));
    const sheet = await screen.findByRole("dialog", { name: "View draft" });
    expect(within(sheet).getByText("You can read this draft. Editing it needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    const message = within(sheet).getByLabelText("Message");
    expect(message).toHaveValue("Hi Dana");
    expect(message).toBeDisabled();
    expect(within(sheet).getByLabelText("Subject")).toBeDisabled();
    expect(within(sheet).queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /Send/ })).not.toBeInTheDocument();

    await user.type(message, " and team");
    expect(message).toHaveValue("Hi Dana");
    await user.click(within(sheet).getByRole("button", { name: "Close panel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(changesRequested(state)).toEqual([]);
  });

  it("doesn't point a viewer to email server setup for a project that can't send", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    renderApp(`/projects/${project.id}/outbox`, stateAs("viewer", { projects: [project], emails: [draft(project.id)] }));

    expect(await screen.findByText("This project has no email server set up, so these drafts can't be sent yet.")).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /dana@synthweekly\.example/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Set up the email server" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Set up sending" })).not.toBeInTheDocument();
  });

  it("lets an editor edit drafts and set up sending, but sending or deleting needs the Approver role", async () => {
    const ready = sendingProject({ name: "Halcyon Studio" });
    const notReady = makeProject({ name: "Orbit Payroll" });
    const editable = draft(ready.id);
    const state = stateAs("editor", {
      projects: [ready, notReady],
      emails: [editable, draft(notReady.id, { recipient_email: "ops@orbit.example" })],
      smtpPasswords: { [ready.id]: "secret" },
    });
    const { user } = renderApp("/outbox", state);

    await screen.findByRole("row", { name: /dana@synthweekly\.example/ });
    expect(await within(row("ops@orbit.example")).findByRole("link", { name: "Set up sending" })).toHaveAttribute(
      "href",
      `/projects/${notReady.id}/settings#email`,
    );
    expect(screen.getByText("Sending or deleting email needs the Approver role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(row("dana@synthweekly.example")).queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(within(row("dana@synthweekly.example")).queryByRole("button", { name: /^Delete email/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Select all sendable drafts")).not.toBeInTheDocument();

    await user.click(within(row("dana@synthweekly.example")).getByRole("button", { name: "Edit" }));
    const editor = await screen.findByRole("dialog", { name: "Edit draft" });
    expect(within(editor).queryByText(/You can read this draft/)).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: /Send/ })).not.toBeInTheDocument();
    const subject = within(editor).getByLabelText("Subject");
    await user.clear(subject);
    await user.type(subject, "Beta invite for Synth Weekly");
    await user.click(within(editor).getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
    expect(state.emails[0]?.subject).toBe("Beta invite for Synth Weekly");
    expect(requestsTo(state, "POST", "/api/email-queue")).toEqual([]);
  });

  it("lets an approver select, send and delete email", async () => {
    const project = sendingProject();
    const email = draft(project.id);
    const state = stateAs("approver", { projects: [project], emails: [email], smtpPasswords: { [project.id]: "secret" } });
    const { user } = renderApp("/outbox", state);

    expect(await screen.findByLabelText("Select all sendable drafts")).toBeInTheDocument();
    expect(await screen.findByText("0 of 20 sends used in the last 24 hours")).toBeInTheDocument();
    expect(screen.queryByText(/needs the Approver role/)).not.toBeInTheDocument();
    expect(within(row("dana@synthweekly.example")).getByRole("button", { name: "Delete email to dana@synthweekly.example" })).toBeInTheDocument();

    await user.click(within(row("dana@synthweekly.example")).getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Send this email?" });
    await user.click(within(dialog).getByRole("button", { name: "Send email" }));

    expect(await screen.findByText("1 email sent")).toBeInTheDocument();
    expect(state.emails[0]?.status).toBe("sent");
  });
});
