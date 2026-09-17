import { useId, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { Eye, Mail, Pencil, Send, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import { emailApi } from "@/lib/api/endpoints";
import type { EmailItem, Project } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useEmailQuota, useEmails, useProjects, useSendEmail, useUndoableDelete, useUpdateEmail } from "@/lib/queries/hooks";
import { keys } from "@/lib/queries/keys";
import { useNow } from "@/lib/hooks/useClock";
import { formatTimestamp, relativeTime } from "@/lib/domain/dates";
import { senderAddress, smtpReady } from "@/lib/domain/queue";
import { routes } from "@/lib/routes";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState, Notice, PageHeader, Segmented, Skeleton } from "@/components/ui/Display";
import { CheckboxInput, Field, FieldRow, FieldStack, Input, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Sheet } from "@/components/ui/Overlay";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/toast";
import { RoleNote, ViewOnlyFieldset, ViewOnlyNotice } from "@/components/access/Access";
import { ProjectSwatch } from "@/components/project/ProjectBits";
import type { ProjectOutletContext } from "@/pages/project/projectContext";
import styles from "./OutboxPage.module.css";

type Filter = "unsent" | "sent" | "all";

/** Why nothing can be sent while the server's daily limit (MAX_EMAILS_PER_DAY) is 0. */
const SENDING_OFF = "Sending email is switched off on this server: its daily limit is 0. An administrator can raise it with the MAX_EMAILS_PER_DAY setting.";

export function OutboxPage({ scope }: { scope: "all" | "project" }) {
  const outlet = useOutletContext<ProjectOutletContext | undefined>();
  const project = scope === "project" ? outlet?.project : undefined;
  const [params, setParams] = useSearchParams();
  const filter = (params.get("show") as Filter | null) ?? "unsent";
  const now = useNow();
  const projects = useProjects();
  const emails = useEmails(project ? { product_id: project.id } : {});
  const send = useSendEmail();
  const quota = useEmailQuota();
  const remove = useUndoableDelete();
  const toast = useToast();
  const { can } = useOrganisation();
  // Editing drafts needs the Editor role; sending and deleting email need the Approver role.
  const canEdit = can("editor");
  const canApprove = can("approver");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EmailItem | null>(null);
  const [confirming, setConfirming] = useState<EmailItem[] | null>(null);
  const [sending, setSending] = useState(false);
  const unavailableId = useId();

  const projectOf = (id: string) => (project && project.id === id ? project : projects.data?.find((p) => p.id === id));
  const all = useMemo(() => emails.data ?? [], [emails.data]);
  const visible = all.filter((e) => (filter === "unsent" ? e.status !== "sent" : filter === "sent" ? e.status === "sent" : true));
  // The daily limit counts sends in the last 24 hours across every project (the server enforces it too).
  // A limit of 0 isn't a limit being reached: sending is switched off on the server.
  const sendingOff = quota.data?.limit === 0;
  const limitReached = quota.data?.remaining === 0;
  const sendable = limitReached || !canApprove ? [] : visible.filter((e) => e.status !== "sent" && smtpReady(projectOf(e.product_id)));
  const allowedNow = (count: number) => Math.min(count, quota.data?.remaining ?? count);
  const selectedItems = visible.filter((e) => selected.has(e.id) && e.status !== "sent");

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const sendAll = async (items: EmailItem[]) => {
    setSending(true);
    let sent = 0;
    const failures: string[] = [];
    for (const item of items) {
      try {
        await send.mutateAsync(item.id);
        sent += 1;
      } catch (err) {
        failures.push(`${item.recipient_email}: ${errorMessage(err)}`);
      }
    }
    setSending(false);
    setConfirming(null);
    setSelected(new Set());
    if (failures.length === 0) {
      toast.show({ title: `${sent} email${sent === 1 ? "" : "s"} sent` });
    } else {
      toast.show({
        title: `${sent} sent, ${failures.length} failed`,
        description: failures.slice(0, 2).join(" · "),
        tone: "crit",
      });
    }
  };

  return (
    <>
      {scope === "all" && (
        <PageHeader
          title="Outbox"
          lede="Email drafts created when you approve outreach results. Each is sent through its project's email server, and only when you press Send."
        />
      )}
      {scope === "project" && project && !smtpReady(project) && all.some((e) => e.status !== "sent") && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Notice tone="warn">
            This project has no email server set up, so these drafts can't be sent yet.
            {canEdit && (
              <>
                {" "}
                <Link to={routes.projectSettings(project.id)}>Set up the email server</Link>
              </>
            )}
          </Notice>
        </div>
      )}

      {sendingOff ? (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Notice tone="warn">
            <span id={unavailableId}>{SENDING_OFF}</span>
          </Notice>
        </div>
      ) : (
        canApprove &&
        limitReached &&
        quota.data && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Notice tone="warn">
              <span id={unavailableId}>
                You&apos;ve reached the daily limit of {quota.data.limit} email{quota.data.limit === 1 ? "" : "s"}.{" "}
                {quota.data.next_available_at
                  ? `You can send again at ${formatTimestamp(quota.data.next_available_at)}.`
                  : "You can send again once earlier sends are more than 24 hours old."}
              </span>
            </Notice>
          </div>
        )
      )}

      <div className={styles.toolbar}>
        <Segmented<Filter>
          label="Show"
          value={filter}
          onChange={(f) => {
            const next = new URLSearchParams(params);
            if (f === "unsent") next.delete("show");
            else next.set("show", f);
            setParams(next, { replace: true });
            setSelected(new Set());
          }}
          options={[
            { value: "unsent", label: `Unsent · ${all.filter((e) => e.status !== "sent").length}` },
            { value: "sent", label: `Sent · ${all.filter((e) => e.status === "sent").length}` },
            { value: "all", label: "All" },
          ]}
        />
        <div className={styles.group}>
          {!canApprove && <RoleNote action="Sending or deleting email" minimum="approver" />}
          {canApprove && quota.data && !sendingOff && (
            <span className={styles.quota} title="The daily limit counts emails sent from every project in the last 24 hours.">
              {quota.data.sent} of {quota.data.limit} sends used in the last 24 hours
            </span>
          )}
          {selectedItems.length > 0 && (
            <Button variant="primary" icon={<Send aria-hidden="true" />} onClick={() => setConfirming(selectedItems)}>
              Send {selectedItems.length} selected
            </Button>
          )}
        </div>
      </div>

      <div className={styles.tableWrap}>
        {emails.isLoading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={32} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={<Mail aria-hidden="true" />} title={filter === "sent" ? "Nothing sent yet" : "No drafts"}>
            Approving a cold outreach, partnership scan or launch announcement result copies any email addresses it contains into drafts here.
          </EmptyState>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.selectCell}>
                  {filter !== "sent" && sendable.length > 0 && (
                    <CheckboxInput
                      aria-label="Select all sendable drafts"
                      checked={sendable.length > 0 && sendable.every((e) => selected.has(e.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(sendable.map((s) => s.id)) : new Set())}
                    />
                  )}
                </th>
                <th className="placard">Recipient</th>
                <th className="placard">Subject</th>
                {scope === "all" && <th className="placard">Project</th>}
                <th className="placard">Status</th>
                <th className="placard" style={{ textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((email) => {
                const p = projectOf(email.product_id);
                const ready = smtpReady(p);
                const unsent = email.status !== "sent";
                return (
                  <tr key={email.id}>
                    <td className={styles.selectCell}>
                      {canApprove && unsent && ready && !limitReached && (
                        <CheckboxInput
                          aria-label={`Select email to ${email.recipient_email}`}
                          checked={selected.has(email.id)}
                          onChange={(e) => toggle(email.id, e.target.checked)}
                        />
                      )}
                    </td>
                    <td>
                      <div className={styles.recipient}>
                        <span className={styles.recipientName}>{email.recipient_name || "No name"}</span>
                        <span className={styles.recipientEmail}>{email.recipient_email}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.subject} title={email.subject}>
                        {email.subject}
                      </div>
                      {email.status === "failed" && email.error && <div className={styles.error}>{email.error}</div>}
                    </td>
                    {scope === "all" && (
                      <td>
                        {p && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <ProjectSwatch color={p.color} />
                            <Link to={routes.projectOutbox(p.id)}>{p.name}</Link>
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      {email.status === "sent" ? (
                        <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                          <Pill tone="ok">Sent</Pill>
                          <span className={styles.meta}>{formatTimestamp(email.sent_at)}</span>
                        </span>
                      ) : email.status === "failed" ? (
                        <Pill tone="crit">Failed</Pill>
                      ) : (
                        <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                          <Pill tone="neutral">Draft</Pill>
                          <span className={styles.meta}>{relativeTime(email.created_at, now)}</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        {unsent && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={canEdit ? <Pencil aria-hidden="true" /> : <Eye aria-hidden="true" />}
                            onClick={() => setEditing(email)}
                          >
                            {canEdit ? "Edit" : "View"}
                          </Button>
                        )}
                        {unsent && ready && canApprove && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Send aria-hidden="true" />}
                            disabled={limitReached}
                            aria-describedby={limitReached ? unavailableId : undefined}
                            onClick={() => setConfirming([email])}
                          >
                            Send
                          </Button>
                        )}
                        {/* Setting up a project's email server needs the Editor role. */}
                        {unsent && !ready && canEdit && p && (
                          <Button asChild size="sm" variant="ghost">
                            <Link to={routes.projectSettings(p.id, "email")} title="This project has no email server, so it can't send yet.">
                              Set up sending
                            </Link>
                          </Button>
                        )}
                        {canApprove && (
                          <IconButton
                            size="sm"
                            variant="dangerGhost"
                            label={`Delete email to ${email.recipient_email}`}
                            onClick={() => remove({ id: email.id, noun: "Email", listKeys: [keys.emailsAll], remove: emailApi.remove })}
                          >
                            <Trash2 aria-hidden="true" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <EmailEditor
        email={editing}
        project={editing ? projectOf(editing.product_id) : undefined}
        sendingOff={sendingOff}
        onClose={() => setEditing(null)}
        onSend={(item) => {
          setEditing(null);
          setConfirming([item]);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && !sending && setConfirming(null)}
        title={confirming && confirming.length === 1 ? "Send this email?" : `Send ${confirming?.length ?? 0} emails?`}
        description="Each email is sent immediately through its project's email server. Sent email can't be recalled."
        confirmLabel={
          confirming && confirming.length === 1 ? "Send email" : `Send ${allowedNow(confirming?.length ?? 0)} emails`
        }
        busy={sending}
        disabled={Boolean(confirming) && allowedNow(confirming?.length ?? 0) === 0}
        onConfirm={() => confirming && void sendAll(confirming.slice(0, allowedNow(confirming.length)))}
      >
        {confirming && quota.data && allowedNow(confirming.length) < confirming.length && (
          <div style={{ marginBottom: "var(--space-3)" }}>
            <Notice tone="warn">
              {`Only ${allowedNow(confirming.length)} of these ${confirming.length} emails can be sent now: the limit is ${quota.data.limit} emails in 24 hours. The rest stay in the Outbox.`}
            </Notice>
          </div>
        )}
        <ul className={styles.recipients}>
          {(confirming ?? []).map((item) => (
            <li key={item.id}>
              <span>
                {item.recipient_name ? `${item.recipient_name} · ` : ""}
                <span className="mono">{item.recipient_email}</span>
              </span>
              <span className={styles.meta}>from {senderAddress(projectOf(item.product_id)) || "project address"}</span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </>
  );
}

function EmailEditor({
  email,
  project,
  sendingOff,
  onClose,
  onSend,
}: {
  email: EmailItem | null;
  project: Project | undefined;
  sendingOff: boolean;
  onClose: () => void;
  onSend: (item: EmailItem) => void;
}) {
  const canEdit = useOrganisation().can("editor");
  return (
    <Sheet
      open={Boolean(email)}
      onOpenChange={(open) => !open && onClose()}
      title={canEdit ? "Edit draft" : "View draft"}
      description={project ? `${project.name} · sent from ${senderAddress(project) || "the project's email server"}` : undefined}
    >
      {email && <EmailForm key={email.id} email={email} ready={smtpReady(project)} sendingOff={sendingOff} onClose={onClose} onSend={onSend} />}
    </Sheet>
  );
}

function EmailForm({
  email,
  ready,
  sendingOff,
  onClose,
  onSend,
}: {
  email: EmailItem;
  ready: boolean;
  sendingOff: boolean;
  onClose: () => void;
  onSend: (item: EmailItem) => void;
}) {
  const { can } = useOrganisation();
  const canEdit = can("editor");
  const canSend = can("approver");
  const update = useUpdateEmail();
  const toast = useToast();
  const [name, setName] = useState(email.recipient_name);
  const [address, setAddress] = useState(email.recipient_email);
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [error, setError] = useState<string | null>(null);
  const sendingOffId = useId();
  const dirty = name !== email.recipient_name || address !== email.recipient_email || subject !== email.subject || body !== email.body;

  const save = async (): Promise<EmailItem | null> => {
    setError(null);
    try {
      const saved = await update.mutateAsync({
        id: email.id,
        data: { recipient_name: name.trim(), recipient_email: address.trim(), subject: subject.trim(), body },
      });
      return saved;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    }
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save()) {
          toast.show({ title: "Draft saved" });
          onClose();
        }
      }}
    >
      <FieldStack>
        {!canEdit && <ViewOnlyNotice action="Editing it">You can read this draft.</ViewOnlyNotice>}
        {email.status === "failed" && email.error && <Notice tone="crit">Last attempt failed: {email.error}</Notice>}
        {canSend && ready && sendingOff && (
          <Notice tone="warn">
            <span id={sendingOffId}>{SENDING_OFF}</span>
          </Notice>
        )}
        <ViewOnlyFieldset readOnly={!canEdit}>
          <FieldRow>
            <Field label="Recipient name" optional>
              {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Recipient email">
              {(props) => <Input {...props} type="email" mono value={address} onChange={(e) => setAddress(e.target.value)} required />}
            </Field>
          </FieldRow>
          <Field label="Subject">{(props) => <Input {...props} value={subject} onChange={(e) => setSubject(e.target.value)} required />}</Field>
          <Field label="Message" hint="Sent as plain text.">
            {(props) => <Textarea {...props} value={body} onChange={(e) => setBody(e.target.value)} rows={14} required />}
          </Field>
        </ViewOnlyFieldset>
        {error && <Notice tone="crit">{error}</Notice>}
        {canEdit ? (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="submit" variant="secondary" loading={update.isPending} disabled={!dirty}>
                Save draft
              </Button>
              {ready && canSend && (
                <Button
                  variant="primary"
                  icon={<Send aria-hidden="true" />}
                  disabled={sendingOff}
                  aria-describedby={sendingOff ? sendingOffId : undefined}
                  onClick={async () => {
                    const saved = dirty ? await save() : email;
                    if (saved) onSend(saved);
                  }}
                >
                  {dirty ? "Save and send…" : "Send…"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={onClose}>
              Close panel
            </Button>
          </div>
        )}
      </FieldStack>
    </form>
  );
}
