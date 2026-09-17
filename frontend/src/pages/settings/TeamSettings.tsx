import { useState } from "react";
import { Navigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import { adminApi } from "@/lib/api/endpoints";
import type { AdminUser } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAdminProjects, useAdminUsers, useRegistration } from "@/lib/queries/hooks";
import { keys } from "@/lib/queries/keys";
import { formatTimestamp } from "@/lib/domain/dates";
import { routes } from "@/lib/routes";
import { Button, IconButton } from "@/components/ui/Button";
import { CopyButton, Notice, Panel, Skeleton } from "@/components/ui/Display";
import { Field, FieldRow, FieldStack, Input, Select, Switch, SwitchField } from "@/components/ui/Field";
import { ConfirmDialog, Modal, Tooltip } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/toast";
import styles from "./Settings.module.css";

export function TeamSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  if (!isAdmin) return <Navigate to={routes.settings()} replace />;
  return <TeamAdmin currentUserId={user.id} />;
}

function TeamAdmin({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const users = useAdminUsers(true);
  const projects = useAdminProjects(true);
  const registration = useRegistration(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [resetLink, setResetLink] = useState<{ email: string; link: string; expiresAt: string } | null>(null);

  const createResetLink = async (person: AdminUser) => {
    setBusy(`reset-${person.id}`);
    try {
      const created = await adminApi.createResetLink(person.id);
      setResetLink({ email: person.email, link: `${window.location.origin}${created.link}`, expiresAt: created.expires_at });
    } catch (err) {
      toast.show({ title: "Reset link not created", description: errorMessage(err), tone: "crit" });
    } finally {
      setBusy(null);
    }
  };

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.show({ title: success });
    } catch (err) {
      toast.show({ title: "Change not saved", description: errorMessage(err), tone: "crit" });
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    }
  };

  return (
    <div className={styles.stack}>
      <Panel title="Sign-up">
        {registration.isLoading ? (
          <Skeleton height={40} />
        ) : (
          <SwitchField
            spread
            label="Allow anyone to create an account"
            description="When off, only administrators can add people, from the section below."
            checked={registration.data?.registration_enabled ?? true}
            disabled={busy === "registration"}
            onCheckedChange={(v) => void run("registration", () => adminApi.setRegistration(v), v ? "Sign-up is open" : "Sign-up is closed")}
          />
        )}
      </Panel>

      <Panel title="People" flush>
        {users.isLoading ? (
          <div style={{ padding: 16 }}>
            <Skeleton height={120} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="placard">Person</th>
                  <th className="placard">Role</th>
                  <th className="placard">Access</th>
                  <th className="placard">Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((u) => {
                  const self = u.id === currentUserId;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 560 }}>
                          {u.name || u.email}
                          {self && <span className={styles.rowMeta}> (you)</span>}
                        </div>
                        <div className="mono" style={{ fontSize: "var(--text-12)", color: "var(--ink-3)" }}>
                          {u.email}
                        </div>
                      </td>
                      <td>
                        <Select
                          aria-label={`Role for ${u.email}`}
                          value={u.role}
                          disabled={self || busy === `role-${u.id}`}
                          onChange={(e) =>
                            void run(`role-${u.id}`, () => adminApi.updateUser(u.id, { role: e.target.value as "admin" | "user" }), "Role updated")
                          }
                          style={{ width: 150 }}
                        >
                          <option value="user">Member</option>
                          <option value="admin">Administrator</option>
                        </Select>
                      </td>
                      <td>
                        <Tooltip content={self ? "You can't disable your own account." : u.enabled ? "Disabling signs them out immediately." : "Let them sign in again."}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <Switch
                              checked={u.enabled}
                              disabled={self || busy === `enabled-${u.id}`}
                              label={`${u.enabled ? "Disable" : "Enable"} ${u.email}`}
                              onCheckedChange={(v) =>
                                void run(`enabled-${u.id}`, () => adminApi.updateUser(u.id, { enabled: v }), v ? `${u.email} can sign in` : `${u.email} is disabled`)
                              }
                            />
                            <span className={styles.rowMeta}>{u.enabled ? "Active" : "Disabled"}</span>
                          </span>
                        </Tooltip>
                      </td>
                      <td className={styles.rowMeta}>{formatTimestamp(u.created_at)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {!self && (
                          <>
                            <Tooltip content="Create a one-time link they can use to choose a new password.">
                              <IconButton
                                size="sm"
                                label={`Create a password reset link for ${u.email}`}
                                disabled={busy === `reset-${u.id}`}
                                onClick={() => void createResetLink(u)}
                              >
                                <KeyRound aria-hidden="true" />
                              </IconButton>
                            </Tooltip>
                            <IconButton size="sm" variant="dangerGhost" label={`Delete ${u.email}`} onClick={() => setDeleting(u)}>
                              <Trash2 aria-hidden="true" />
                            </IconButton>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AddPerson onAdded={() => void queryClient.invalidateQueries({ queryKey: keys.adminUsers() })} />

      <TransferProject users={users.data ?? []} projects={projects.data ?? []} />

      <Modal
        open={Boolean(resetLink)}
        onOpenChange={(open) => !open && setResetLink(null)}
        title={`Password reset link for ${resetLink?.email ?? ""}`}
        description={`Send this link to ${resetLink?.email ?? "them"} yourself. It works once, until ${resetLink ? formatTimestamp(resetLink.expiresAt) : ""}, and creating another one stops this one working.`}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code className="mono" style={{ wordBreak: "break-all" }}>
            {resetLink?.link}
          </code>
          <CopyButton value={resetLink?.link ?? ""} label="Copy link" toastTitle="Reset link copied" size="sm" />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.email ?? "this person"}?`}
        description="Their account is deleted permanently. Organisations only they belong to are deleted with everything in them; in organisations shared with other people, what they created stays."
        confirmLabel="Delete account"
        destructive
        busy={busy === "delete"}
        onConfirm={() => {
          if (!deleting) return;
          void run("delete", () => adminApi.deleteUser(deleting.id), `${deleting.email} deleted`).then(() => setDeleting(null));
        }}
      />
    </div>
  );
}

function AddPerson({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Panel title="Add a person">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            await adminApi.createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password });
            toast.show({ title: `${form.email.trim()} added`, description: "Share the password with them securely." });
            setForm({ name: "", email: "", password: "" });
            onAdded();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <FieldStack>
          <FieldRow>
            <Field label="Name" optional>
              {(p) => <Input {...p} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />}
            </Field>
            <Field label="Email">
              {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />}
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              )}
            </Field>
          </FieldRow>
          <p className={styles.rowMeta}>
            New people get an organisation of their own. Share the password with them securely; they can change it later with a reset link.
          </p>
          {error && <Notice tone="crit">{error}</Notice>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" loading={busy} disabled={!form.email.trim() || form.password.length < 8}>
              Add person
            </Button>
          </div>
        </FieldStack>
      </form>
    </Panel>
  );
}

function TransferProject({ users, projects }: { users: AdminUser[]; projects: Array<{ id: string; name: string; user_id: string; user_email: string }> }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const project = projects.find((p) => p.id === projectId);
  const target = users.find((u) => u.id === userId);

  return (
    <Panel title="Transfer a project">
      <FieldStack>
        <p className={styles.lede}>
          Moves a project with its review results, Outbox emails, calendar entries and ideas into another person&apos;s own organisation.
          Templates and company profiles stay where they are.
        </p>
        <FieldRow>
          <Field label="Project">
            {(p) => (
              <Select {...p} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Choose a project</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} — {proj.user_email}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="New owner">
            {(p) => (
              <Select {...p} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Choose a person</option>
                {users
                  .filter((u) => u.id !== project?.user_id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} — ${u.email}` : u.email}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </FieldRow>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" disabled={!project || !target} onClick={() => setConfirming(true)}>
            Transfer…
          </Button>
        </div>
      </FieldStack>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Transfer ${project?.name ?? "project"}?`}
        description={`It moves into ${target?.email ?? "the new owner"}'s own organisation. People in its current organisation lose access to it.`}
        confirmLabel="Transfer project"
        busy={busy}
        onConfirm={async () => {
          if (!project || !target) return;
          setBusy(true);
          try {
            await adminApi.transferProject(project.id, target.id);
            toast.show({ title: `${project.name} transferred to ${target.email}` });
            setProjectId("");
            setUserId("");
            setConfirming(false);
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
            void queryClient.invalidateQueries({ queryKey: keys.projects });
          } catch (err) {
            toast.show({ title: "Transfer failed", description: errorMessage(err), tone: "crit" });
          } finally {
            setBusy(false);
          }
        }}
      />
    </Panel>
  );
}
