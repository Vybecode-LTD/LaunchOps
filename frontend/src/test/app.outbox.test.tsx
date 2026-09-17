import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { EmailItem, Project } from "@/lib/api/types";
import { UNDO_WINDOW_MS } from "@/lib/queries/hooks";
import { API, id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

/** A project whose email server is set up (the password is saved separately, in FakeState.smtpPasswords). */
function sendingProject(overrides: Partial<Project> = {}): Project {
  return makeProject({ email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_user: "launch@vybecod.example" }, ...overrides });
}

const row = (address: string) => screen.getByRole("row", { name: new RegExp(address.replace(/\./g, "\\.")) });
const queryRow = (address: string) => screen.queryByRole("row", { name: new RegExp(address.replace(/\./g, "\\.")) });

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

describe("Outbox", () => {
  it("sends only after confirmation, showing recipient and sender", async () => {
    const project = makeProject({
      email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_user: "launch@vybecod.example", from_name: "Alex" },
    });
    const email = draft(project.id);
    const state = makeState({ projects: [project], emails: [email], smtpPasswords: { [project.id]: "secret" } });
    const { user } = renderApp("/outbox", state);

    await user.click(await screen.findByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Send this email?" });
    expect(within(dialog).getByText("dana@synthweekly.example")).toBeInTheDocument();
    expect(within(dialog).getByText("from Alex <launch@vybecod.example>")).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/email-queue")).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Send email" }));
    await waitFor(() => expect(requestsTo(state, "POST", `/api/email-queue/${email.id}/send`)).toHaveLength(1));
    expect(await screen.findByText("1 email sent")).toBeInTheDocument();
  });

  it("points to email server setup instead of offering Send when a project can't send", async () => {
    const project = makeProject();
    renderApp("/outbox", makeState({ projects: [project], emails: [draft(project.id)] }));

    expect(await screen.findByRole("link", { name: "Set up sending" })).toHaveAttribute("href", `/projects/${project.id}/settings#email`);
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("saves edits to a draft", async () => {
    const project = makeProject();
    const email = draft(project.id);
    const state = makeState({ projects: [project], emails: [email] });
    const { user } = renderApp("/outbox", state);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const subject = await screen.findByLabelText("Subject");
    await user.clear(subject);
    await user.type(subject, "Beta invite for Synth Weekly");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(requestsTo(state, "PATCH", `/api/email-queue/${email.id}`)[0]?.body).toMatchObject({ subject: "Beta invite for Synth Weekly" }),
    );
  });
  it("shows how much of the daily sending limit is used", async () => {
    const project = makeProject({ email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_user: "launch@vybecod.example" } });
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const state = makeState({
      projects: [project],
      emails: [draft(project.id), draft(project.id, { status: "sent", sent_at: hourAgo }), draft(project.id, { status: "sent", sent_at: hourAgo })],
      smtpPasswords: { [project.id]: "secret" },
    });
    renderApp("/outbox", state);

    expect(await screen.findByText("2 of 20 sends used in the last 24 hours")).toBeInTheDocument();
  });

  it("explains the daily limit once it's reached and doesn't offer Send", async () => {
    const project = makeProject({ email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_user: "launch@vybecod.example" } });
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const state = makeState({
      projects: [project],
      emails: [draft(project.id), draft(project.id, { status: "sent", sent_at: hourAgo })],
      smtpPasswords: { [project.id]: "secret" },
      emailDailyLimit: 1,
    });
    renderApp("/outbox", state);

    expect(await screen.findByText(/You've reached the daily limit of 1 email\. You can send again at /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.queryByLabelText("Select all sendable drafts")).not.toBeInTheDocument();
  });

  it("says sending is switched off when the server's daily limit is 0, rather than that the limit is reached", async () => {
    const project = sendingProject();
    const state = makeState({ projects: [project], emails: [draft(project.id)], smtpPasswords: { [project.id]: "secret" }, emailDailyLimit: 0 });
    const { user } = renderApp("/outbox", state);
    const switchedOff = "Sending email is switched off on this server: its daily limit is 0. An administrator can raise it with the MAX_EMAILS_PER_DAY setting.";

    expect(await screen.findByText(switchedOff)).toBeInTheDocument();
    expect(screen.queryByText(/You've reached the daily limit/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sends used in the last 24 hours/)).not.toBeInTheDocument();
    const send = within(row("dana@synthweekly.example")).getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription(switchedOff);
    expect(screen.queryByLabelText("Select all sendable drafts")).not.toBeInTheDocument();

    await user.click(within(row("dana@synthweekly.example")).getByRole("button", { name: "Edit" }));
    const editor = await screen.findByRole("dialog", { name: "Edit draft" });
    const sendFromEditor = within(editor).getByRole("button", { name: "Send…" });
    expect(sendFromEditor).toBeDisabled();
    expect(sendFromEditor).toHaveAccessibleDescription(switchedOff);
    expect(requestsTo(state, "POST", "/api/email-queue/")).toEqual([]);
  });

  it("says why a reached daily limit leaves Send unavailable", async () => {
    const project = sendingProject();
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const state = makeState({
      projects: [project],
      emails: [draft(project.id), draft(project.id, { status: "sent", sent_at: hourAgo })],
      smtpPasswords: { [project.id]: "secret" },
      emailDailyLimit: 1,
    });
    renderApp("/outbox", state);

    const notice = await screen.findByText(/^You've reached the daily limit of 1 email\./);
    expect(within(row("dana@synthweekly.example")).getByRole("button", { name: "Send" })).toHaveAccessibleDescription(notice.textContent!);
  });

  it("sends only as many selected drafts as the daily limit still allows", async () => {
    const project = makeProject({ email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_user: "launch@vybecod.example" } });
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const drafts = [0, 1, 2].map((n) => draft(project.id, { recipient_email: `r${n}@example.com` }));
    const state = makeState({
      projects: [project],
      emails: [...drafts, draft(project.id, { status: "sent", sent_at: hourAgo })],
      smtpPasswords: { [project.id]: "secret" },
      emailDailyLimit: 3,
    });
    const { user } = renderApp("/outbox", state);

    await user.click(await screen.findByLabelText("Select all sendable drafts"));
    await user.click(screen.getByRole("button", { name: "Send 3 selected" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Send 3 emails?" });
    expect(within(dialog).getByText("Only 2 of these 3 emails can be sent now: the limit is 3 emails in 24 hours. The rest stay in the Outbox.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Send 2 emails" }));

    await waitFor(() => expect(requestsTo(state, "POST", "/api/email-queue/")).toHaveLength(2));
    expect(await screen.findByText("2 emails sent")).toBeInTheDocument();
    expect(state.emails.filter((e) => e.status !== "sent")).toHaveLength(1);
  });

  it("shows unsent, sent or all email, with each one's status", async () => {
    const project = makeProject();
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const emails = [
      draft(project.id),
      draft(project.id, { recipient_name: "", recipient_email: "tips@beatmakers.example", status: "failed", error: "550 Mailbox unavailable" }),
      draft(project.id, { recipient_email: "hello@loopcast.example", status: "sent", sent_at: hourAgo }),
    ];
    const { user } = renderApp("/outbox", makeState({ projects: [project], emails }));

    expect(await screen.findByRole("row", { name: /dana@synthweekly\.example/ })).toHaveTextContent("Draft");
    expect(row("tips@beatmakers.example")).toHaveTextContent("Failed");
    expect(row("tips@beatmakers.example")).toHaveTextContent("550 Mailbox unavailable");
    expect(row("tips@beatmakers.example")).toHaveTextContent("No name");
    expect(queryRow("hello@loopcast.example")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sent · 1" }));
    expect(await screen.findByRole("row", { name: /hello@loopcast\.example/ })).toHaveTextContent("Sent");
    expect(within(row("hello@loopcast.example")).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(queryRow("dana@synthweekly.example")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));

    await user.click(screen.getByRole("button", { name: "Unsent · 2" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
  });

  it("sends the drafts you select and reports the ones the email server refused", async () => {
    const project = sendingProject();
    const addresses = ["dana@synthweekly.example", "tips@beatmakers.example", "hello@loopcast.example"];
    const drafts = addresses.map((recipient_email) => draft(project.id, { recipient_email }));
    const state = makeState({
      projects: [project],
      emails: drafts,
      smtpPasswords: { [project.id]: "secret" },
      smtpErrors: { "tips@beatmakers.example": "550 Mailbox unavailable" },
    });
    const { user } = renderApp("/outbox", state);

    await user.click(await screen.findByLabelText("Select email to dana@synthweekly.example"));
    await user.click(screen.getByLabelText("Select email to hello@loopcast.example"));
    await user.click(screen.getByLabelText("Select email to hello@loopcast.example"));
    await user.click(screen.getByLabelText("Select email to tips@beatmakers.example"));
    expect(screen.getByLabelText("Select all sendable drafts")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Send 2 selected" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Send 2 emails?" });
    expect(within(dialog).getByText("dana@synthweekly.example")).toBeInTheDocument();
    expect(within(dialog).getByText("tips@beatmakers.example")).toBeInTheDocument();
    expect(within(dialog).queryByText("hello@loopcast.example")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Send 2 emails" }));

    expect(await screen.findByText("1 sent, 1 failed")).toBeInTheDocument();
    expect(screen.getByText("tips@beatmakers.example: Send failed: 550 Mailbox unavailable")).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/email-queue/").map((r) => r.path)).toEqual([
      `/api/email-queue/${drafts[0]!.id}/send`,
      `/api/email-queue/${drafts[1]!.id}/send`,
    ]);
    // The sent email leaves the list; the refused one stays, marked failed with the server's reason.
    await waitFor(() => expect(queryRow("dana@synthweekly.example")).not.toBeInTheDocument());
    expect(row("tips@beatmakers.example")).toHaveTextContent("Failed");
    expect(row("tips@beatmakers.example")).toHaveTextContent("550 Mailbox unavailable");
  });

  it("clears a selection, and sends nothing when the confirmation is cancelled", async () => {
    const project = sendingProject();
    const state = makeState({ projects: [project], emails: [draft(project.id)], smtpPasswords: { [project.id]: "secret" } });
    const { user } = renderApp("/outbox", state);

    const selectAll = await screen.findByLabelText("Select all sendable drafts");
    await user.click(selectAll);
    expect(screen.getByRole("button", { name: "Send 1 selected" })).toBeInTheDocument();
    await user.click(selectAll);
    expect(screen.queryByRole("button", { name: /selected/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Send this email?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(requestsTo(state, "POST", "/api/email-queue/")).toEqual([]);
    expect(row("dana@synthweekly.example")).toHaveTextContent("Draft");
  });

  it("sends a draft from the editor, saving any changes first", async () => {
    const project = sendingProject({
      email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_user: "launch@vybecod.example", from_name: "Alex" },
    });
    const email = draft(project.id, { status: "failed", error: "421 Try again later" });
    const state = makeState({ projects: [project], emails: [email], smtpPasswords: { [project.id]: "secret" } });
    const { user } = renderApp("/outbox", state);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    let editor = await screen.findByRole("dialog", { name: "Edit draft" });
    expect(within(editor).getByText("VybeCode DSP · sent from Alex <launch@vybecod.example>")).toBeInTheDocument();
    expect(within(editor).getByText("Last attempt failed: 421 Try again later")).toBeInTheDocument();

    // Unchanged: straight to the confirmation.
    await user.click(within(editor).getByRole("button", { name: "Send…" }));
    let dialog = await screen.findByRole("alertdialog", { name: "Send this email?" });
    expect(requestsTo(state, "PATCH", "/api/email-queue")).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Edit" }));
    editor = await screen.findByRole("dialog", { name: "Edit draft" });
    const subject = within(editor).getByLabelText("Subject");
    await user.clear(subject);
    await user.type(subject, "Beta invite for Synth Weekly");
    await user.click(within(editor).getByRole("button", { name: "Save and send…" }));

    dialog = await screen.findByRole("alertdialog", { name: "Send this email?" });
    expect(requestsTo(state, "PATCH", `/api/email-queue/${email.id}`).map((r) => r.body)).toEqual([
      { recipient_name: "Dana Whitfield", recipient_email: "dana@synthweekly.example", subject: "Beta invite for Synth Weekly", body: "Hi Dana" },
    ]);
    expect(screen.queryByRole("dialog", { name: "Edit draft" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Send email" }));

    expect(await screen.findByText("1 email sent")).toBeInTheDocument();
    expect(requestsTo(state, "POST", `/api/email-queue/${email.id}/send`)).toHaveLength(1);
  });

  it("keeps a draft open with the server's reason when it can't be saved", async () => {
    const project = makeProject();
    const email = draft(project.id);
    const state = makeState({ projects: [project], emails: [email] });
    const { user } = renderApp("/outbox", state);
    // The backend's address check is stricter than the browser's.
    server.use(
      http.patch(`${API}/api/email-queue/:id`, () => HttpResponse.json({ detail: "recipient_email must be a valid email address" }, { status: 422 })),
    );

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const editor = await screen.findByRole("dialog", { name: "Edit draft" });
    // This project has no email server, so the editor offers no Send.
    expect(within(editor).queryByRole("button", { name: /Send/ })).not.toBeInTheDocument();
    const address = within(editor).getByLabelText("Recipient email");
    await user.clear(address);
    await user.type(address, "dana@synthweekly");
    await user.click(within(editor).getByRole("button", { name: "Save draft" }));

    expect(await within(editor).findByRole("alert")).toHaveTextContent("recipient_email must be a valid email address");
    expect(screen.getByRole("dialog", { name: "Edit draft" })).toBeInTheDocument();
    expect(screen.queryByText("Draft saved")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit draft" })).not.toBeInTheDocument());
    expect(row("dana@synthweekly.example")).toBeInTheDocument();
  });

  it("deletes an email once the undo window closes, unless it's undone", async () => {
    const project = makeProject();
    const keep = draft(project.id);
    const discard = draft(project.id, { recipient_email: "tips@beatmakers.example" });
    const state = makeState({ projects: [project], emails: [keep, discard] });
    const { user } = renderApp("/outbox", state);

    await user.click(await screen.findByRole("button", { name: "Delete email to dana@synthweekly.example" }));
    await waitFor(() => expect(queryRow("dana@synthweekly.example")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("row", { name: /dana@synthweekly\.example/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete email to tips@beatmakers.example" }));
    await waitFor(() => expect(queryRow("tips@beatmakers.example")).not.toBeInTheDocument());
    await waitFor(() => expect(requestsTo(state, "DELETE", "/api/email-queue")).toHaveLength(1), { timeout: UNDO_WINDOW_MS + 3000 });
    expect(requestsTo(state, "DELETE", "/api/email-queue")[0]?.path).toBe(`/api/email-queue/${discard.id}`);
    expect(state.emails).toEqual([keep]);
    expect(row("dana@synthweekly.example")).toBeInTheDocument();
  }, 20_000);

  it("in a project, shows only its email and says its drafts can't be sent without an email server", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const other = makeProject({ name: "Orbit Payroll" });
    const state = makeState({ projects: [project, other], emails: [draft(project.id), draft(other.id, { recipient_email: "ops@orbit.example" })] });
    const { user } = renderApp(`/projects/${project.id}/outbox`, state);

    expect(await screen.findByText(/This project has no email server set up, so these drafts can't be sent yet\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up the email server" })).toHaveAttribute("href", `/projects/${project.id}/settings`);
    expect(await screen.findByRole("row", { name: /dana@synthweekly\.example/ })).toBeInTheDocument();
    expect(queryRow("ops@orbit.example")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Project" })).not.toBeInTheDocument();
    expect(requestsTo(state, "GET", `/api/email-queue?product_id=${project.id}`).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Sent · 0" }));
    expect(await screen.findByText("Nothing sent yet")).toBeInTheDocument();
  });
});
