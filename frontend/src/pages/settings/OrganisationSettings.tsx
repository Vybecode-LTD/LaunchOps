import { useState } from "react";
import { useNavigate } from "react-router";
import { LogOut, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import { organisationApi } from "@/lib/api/endpoints";
import type { Invitation, OrganisationMember, OrgRole } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, roleWithArticle, useOrganisation } from "@/lib/auth/organisation";
import {
  useChangeMemberRole,
  useInvitations,
  useInvite,
  useOrganisationMembers,
  useRemoveMember,
  useWithdrawInvitation,
} from "@/lib/queries/hooks";
import { formatTimestamp } from "@/lib/domain/dates";
import { routes } from "@/lib/routes";
import { Button, IconButton } from "@/components/ui/Button";
import { CopyButton, Definitions, Notice, Panel, Skeleton } from "@/components/ui/Display";
import { Field, FieldRow, FieldStack, Input, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/toast";
import styles from "./Settings.module.css";

export function OrganisationSettings() {
  const { current, can } = useOrganisation();
  if (!current) return null;
  const isOwner = can("owner");
  return (
    <div className={styles.stack}>
      <NamePanel key={current.id} name={current.name} role={current.role} editable={isOwner} />
      <MembersPanel organisationName={current.name} isOwner={isOwner} />
      {isOwner && <InvitePanel organisationName={current.name} />}
      {isOwner && <PendingInvitations />}
      <Panel title="What each role can do">
        <Definitions items={ROLES.map((role) => [ROLE_LABELS[role], ROLE_DESCRIPTIONS[role]])} />
      </Panel>
    </div>
  );
}

function NamePanel({ name, role, editable }: { name: string; role: OrgRole; editable: boolean }) {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();

  if (!editable) {
    return (
      <Panel title="Organisation">
        <Definitions items={[["Name", name], ["Your role", `${ROLE_LABELS[role]}. ${ROLE_DESCRIPTIONS[role]}`]]} />
      </Panel>
    );
  }
  return (
    <Panel title="Organisation">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            await organisationApi.rename(trimmed);
            await refreshUser();
            toast.show({ title: `Renamed to ${trimmed}` });
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <FieldStack>
          <Field label="Name" hint="Shown to everyone in the organisation, and in the organisation switcher.">
            {(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} required maxLength={120} />}
          </Field>
          {error && <Notice tone="crit">{error}</Notice>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" loading={busy} disabled={!trimmed || trimmed === name}>
              Save name
            </Button>
          </div>
        </FieldStack>
      </form>
    </Panel>
  );
}

function MembersPanel({ organisationName, isOwner }: { organisationName: string; isOwner: boolean }) {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const members = useOrganisationMembers();
  const changeRole = useChangeMemberRole();
  const removeMember = useRemoveMember();
  const [removing, setRemoving] = useState<OrganisationMember | null>(null);
  const leaving = removing?.user_id === user?.id;

  const updateRole = (member: OrganisationMember, role: OrgRole) => {
    changeRole.mutate(
      { userId: member.user_id, role },
      {
        onSuccess: () => {
          toast.show({ title: `${member.name || member.email} is now ${roleWithArticle(role)}` });
          if (member.user_id === user?.id) void refreshUser();
        },
        onError: (err) => toast.show({ title: "Role not changed", description: errorMessage(err), tone: "crit" }),
      },
    );
  };

  return (
    <Panel title="Members" flush>
      {members.isLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton height={96} />
        </div>
      ) : members.isError ? (
        <div style={{ padding: 16 }}>
          <Notice tone="crit">{errorMessage(members.error)}</Notice>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="placard">Person</th>
                <th className="placard">Role</th>
                <th className="placard">Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(members.data ?? []).map((member) => {
                const self = member.user_id === user?.id;
                return (
                  <tr key={member.user_id}>
                    <td>
                      <div style={{ fontWeight: 560 }}>
                        {member.name || member.email}
                        {self && <span className={styles.rowMeta}> (you)</span>}
                      </div>
                      <div className="mono" style={{ fontSize: "var(--text-12)", color: "var(--ink-3)" }}>
                        {member.email}
                      </div>
                    </td>
                    <td>
                      {isOwner ? (
                        <Select
                          aria-label={`Role for ${member.email}`}
                          value={member.role}
                          disabled={changeRole.isPending}
                          onChange={(e) => updateRole(member, e.target.value as OrgRole)}
                          style={{ width: 150 }}
                        >
                          {[...ROLES].reverse().map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        ROLE_LABELS[member.role]
                      )}
                    </td>
                    <td className={styles.rowMeta}>{formatTimestamp(member.joined_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      {self ? (
                        <Button size="sm" variant="ghost" icon={<LogOut aria-hidden="true" />} onClick={() => setRemoving(member)}>
                          Leave
                        </Button>
                      ) : (
                        isOwner && (
                          <IconButton size="sm" variant="dangerGhost" label={`Remove ${member.email}`} onClick={() => setRemoving(member)}>
                            <Trash2 aria-hidden="true" />
                          </IconButton>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={leaving ? `Leave ${organisationName}?` : `Remove ${removing?.email ?? "this person"}?`}
        description={
          leaving
            ? "You lose access to its projects, results and drafts. An owner can invite you back."
            : "They lose access to the organisation straight away. What they created stays."
        }
        confirmLabel={leaving ? "Leave organisation" : "Remove member"}
        destructive
        busy={removeMember.isPending}
        onConfirm={() => {
          if (!removing) return;
          removeMember.mutate(removing.user_id, {
            onSuccess: async () => {
              setRemoving(null);
              if (leaving) {
                toast.show({ title: `You left ${organisationName}` });
                await refreshUser();
                navigate(routes.portfolio);
              } else {
                toast.show({ title: `${removing.email} removed` });
              }
            },
            onError: (err) => {
              setRemoving(null);
              toast.show({ title: leaving ? "You're still a member" : "Member not removed", description: errorMessage(err), tone: "crit" });
            },
          });
        }}
      />
    </Panel>
  );
}

function InvitePanel({ organisationName }: { organisationName: string }) {
  const invite = useInvite();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("editor");
  const [created, setCreated] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const link = created?.link ? `${window.location.origin}${created.link}` : "";

  return (
    <Panel title="Invite someone">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          invite.mutate(
            { email: email.trim(), role },
            {
              onSuccess: (invitation) => {
                setCreated(invitation);
                setEmail("");
              },
              onError: (err) => setError(errorMessage(err)),
            },
          );
        }}
      >
        <FieldStack>
          <FieldRow>
            <Field label="Email">
              {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />}
            </Field>
            <Field label="Role" hint={ROLE_DESCRIPTIONS[role]}>
              {(p) => (
                <Select {...p} value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
                  {[...ROLES].reverse().map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </FieldRow>
          {error && <Notice tone="crit">{error}</Notice>}
          {created && (
            <div role="status">
              <Notice tone="signal">
                <span style={{ display: "block", marginBottom: 8 }}>
                  {created.emailed
                    ? `We emailed ${created.email} an invitation to join ${organisationName} as ${roleWithArticle(created.role)}. You can also send them this link.`
                    : `Send ${created.email} this link to join ${organisationName} as ${roleWithArticle(created.role)}. LaunchOps can't email it because no mail server is set up.`}{" "}
                  It works once, until {formatTimestamp(created.expires_at)}.
                </span>
                <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <code className="mono" style={{ wordBreak: "break-all" }}>
                    {link}
                  </code>
                  <CopyButton value={link} label="Copy link" toastTitle="Invitation link copied" size="sm" />
                </span>
              </Notice>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" loading={invite.isPending} disabled={!email.trim()}>
              Create invitation
            </Button>
          </div>
        </FieldStack>
      </form>
    </Panel>
  );
}

function PendingInvitations() {
  const invitations = useInvitations(true);
  const withdraw = useWithdrawInvitation();
  const toast = useToast();
  if (invitations.isLoading) return <Skeleton height={48} />;
  const pending = invitations.data ?? [];
  if (pending.length === 0) return null;
  return (
    <Panel title="Waiting to be accepted" flush>
      {pending.map((invitation) => (
        <div key={invitation.id} className={styles.row}>
          <div className={styles.rowMain}>
            <span className={styles.rowTitle}>{invitation.email}</span>
            <span className={styles.rowMeta}>
              {ROLE_LABELS[invitation.role]} · invited by {invitation.invited_by || "a former member"} · expires {formatTimestamp(invitation.expires_at)}
            </span>
          </div>
          <div className={styles.rowControls}>
            <Button
              size="sm"
              variant="ghost"
              disabled={withdraw.isPending}
              onClick={() =>
                withdraw.mutate(invitation.id, {
                  onSuccess: () => toast.show({ title: `Invitation for ${invitation.email} withdrawn` }),
                  onError: (err) => toast.show({ title: "Invitation not withdrawn", description: errorMessage(err), tone: "crit" }),
                })
              }
            >
              Withdraw
            </Button>
          </div>
        </div>
      ))}
    </Panel>
  );
}
