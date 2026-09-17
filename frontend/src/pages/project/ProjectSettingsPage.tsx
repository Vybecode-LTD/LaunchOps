import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { errorMessage } from "@/lib/api/client";
import type { CompanyDetails, EmailSettings, Project, ProjectType, ProjectUpdate } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useBrands, useDeleteProject, useUpdateProject } from "@/lib/queries/hooks";
import { PROJECT_TYPE_LABELS, cleanDescription, projectType, swatchColor } from "@/lib/domain/projects";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Notice, Panel, Segmented } from "@/components/ui/Display";
import { Field, FieldRow, FieldStack, Input, Select, SwitchField, TagInput, Textarea } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/toast";
import { SwatchPicker } from "@/components/project/SwatchPicker";
import { RoleNote, ViewOnlyFieldset, ViewOnlyNotice } from "@/components/access/Access";
import { useProjectContext } from "./projectContext";
import styles from "./ProjectPages.module.css";

export function ProjectSettingsPage() {
  const project = useProjectContext();
  const readOnly = !useOrganisation().can("editor");
  return (
    <>
      {readOnly && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <ViewOnlyNotice action="Changing them">You can view this project's settings.</ViewOnlyNotice>
        </div>
      )}
      <div className={styles.split}>
        <div className={styles.column}>
          {/* Keyed by project so switching projects never carries unsaved edits across. */}
          <DetailsSection key={`details-${project.id}`} project={project} readOnly={readOnly} />
          <CompanySection key={`company-${project.id}`} project={project} readOnly={readOnly} />
          <EmailSection key={`email-${project.id}`} project={project} readOnly={readOnly} />
        </div>
        <div className={styles.column}>
          <DangerSection project={project} />
        </div>
      </div>
    </>
  );
}

function SaveBar({ dirty, busy, error, onReset }: { dirty: boolean; busy: boolean; error: string | null; onReset: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
      {error && (
        <span role="alert" style={{ color: "var(--crit)", fontSize: "var(--text-13)", marginRight: "auto" }}>
          {error}
        </span>
      )}
      <Button variant="ghost" onClick={onReset} disabled={!dirty || busy}>
        Discard changes
      </Button>
      <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
        Save
      </Button>
    </div>
  );
}

function useSave(project: Project, success: string) {
  const update = useUpdateProject(project.id);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: ProjectUpdate) => {
    setError(null);
    try {
      await update.mutateAsync(patch);
      toast.show({ title: success });
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  };
  return { save, busy: update.isPending, error };
}

/** A settings section's form. Without the Editor role its values stay readable and every control is disabled. */
function Form({ onSubmit, readOnly, children }: { onSubmit: () => void; readOnly: boolean; children: ReactNode }) {
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <ViewOnlyFieldset readOnly={readOnly}>
        <FieldStack>{children}</FieldStack>
      </ViewOnlyFieldset>
    </form>
  );
}

/* ─── Details ─── */

function DetailsSection({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const initial = {
    name: project.name,
    tagline: project.tagline ?? "",
    url: project.url ?? "",
    description: cleanDescription(project.description),
    keywords: project.keywords ?? [],
    color: swatchColor(project.color),
    project_type: projectType(project),
  };
  const [form, setForm] = useState(initial);
  const { save, busy, error } = useSave(project, "Project details saved");
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const patch: ProjectUpdate = {};
  if (form.name.trim() !== project.name) patch.name = form.name.trim();
  if (form.tagline !== (project.tagline ?? "")) patch.tagline = form.tagline;
  if (form.url.trim() !== (project.url ?? "")) patch.url = form.url.trim();
  if (form.description !== (project.description ?? "")) patch.description = form.description;
  if (JSON.stringify(form.keywords) !== JSON.stringify(project.keywords ?? [])) patch.keywords = form.keywords;
  if (form.color !== project.color) patch.color = form.color;
  if (form.project_type !== project.project_type) patch.project_type = form.project_type;
  // Legacy projects also get their type prefix and old color migrated on the next save.
  const userChanged = JSON.stringify(form) !== JSON.stringify(initial);

  return (
    <Panel title="Project details">
      <Form onSubmit={() => void save(patch)} readOnly={readOnly}>
        <Segmented<ProjectType>
          label="Project type"
          value={form.project_type}
          onChange={(v) => set("project_type", v)}
          options={(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((t) => ({ value: t, label: PROJECT_TYPE_LABELS[t] }))}
        />
        <FieldRow>
          <Field label="Name">{(p) => <Input {...p} value={form.name} onChange={(e) => set("name", e.target.value)} required />}</Field>
          <Field label="Tagline" optional>
            {(p) => <Input {...p} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />}
          </Field>
        </FieldRow>
        <Field label="Website" optional hint="The default page for press kit, press release and SEO operations.">
          {(p) => <Input {...p} type="url" mono value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />}
        </Field>
        <Field
          label="Description"
          hint={`${form.description.trim().length} characters. Sent as context with every operation; 80 or more counts toward readiness.`}
        >
          {(p) => <Textarea {...p} value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} />}
        </Field>
        <Field label="Keywords" optional hint="Press Enter or comma to add. Operations weave these into research and copy.">
          {(p) => <TagInput id={p.id} value={form.keywords} onChange={(v) => set("keywords", v)} placeholder="no-code, audio plugins" />}
        </Field>
        <Field label="Color">{(p) => <SwatchPicker id={p.id} value={form.color} onChange={(v) => set("color", v)} />}</Field>
        <SaveBar dirty={userChanged} busy={busy} error={error} onReset={() => setForm(initial)} />
      </Form>
    </Panel>
  );
}

/* ─── Company ─── */

const COMPANY_FIELDS: Array<{ key: keyof CompanyDetails; label: string; placeholder?: string; wide?: boolean }> = [
  { key: "company_name", label: "Company name" },
  { key: "industry", label: "Industry" },
  { key: "location", label: "Location", placeholder: "City, region" },
  { key: "founded", label: "Founded", placeholder: "2024" },
  { key: "founder_name", label: "Founder or CEO" },
  { key: "founder_title", label: "Title" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Press email" },
  { key: "company_size", label: "Company size", placeholder: "1–10 employees" },
];

function CompanySection({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const brands = useBrands();
  const initialBrand = project.brand_id ?? "";
  const initialDetails: CompanyDetails = project.company_details ?? {};
  const [brandId, setBrandId] = useState(initialBrand);
  const [details, setDetails] = useState<CompanyDetails>(initialDetails);
  const { save, busy, error } = useSave(project, "Company saved");
  const brand = brands.data?.find((b) => b.id === brandId);
  const dirty = brandId !== initialBrand || JSON.stringify(details) !== JSON.stringify(initialDetails);

  return (
    <Panel title="Company">
      <Form onSubmit={() => void save({ brand_id: brandId || null, company_details: details })} readOnly={readOnly}>
        <Field
          label="Company profile"
          hint={
            <>
              Companies are shared across projects. <Link to={routes.settings("companies")}>Manage companies</Link>
            </>
          }
        >
          {(p) => (
            <Select {...p} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">None — use the details below</option>
              {(brands.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.industry ? ` (${b.industry})` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {brand ? (
          <Notice>
            Operations for this project use <strong>{brand.name}</strong>: its company details, boilerplate and voice (tone, keywords, phrases to avoid)
            replace the workspace voice.
          </Notice>
        ) : (
          <>
            <div className="placard">Company details for this project</div>
            <div className={styles.inlineForm}>
              {COMPANY_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} optional>
                  {(p) => (
                    <Input {...p} value={details[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))} />
                  )}
                </Field>
              ))}
            </div>
            <Field label="Boilerplate" optional hint="The “About” paragraph at the end of press releases.">
              {(p) => <Textarea {...p} value={details.boilerplate ?? ""} onChange={(e) => setDetails((d) => ({ ...d, boilerplate: e.target.value }))} rows={4} />}
            </Field>
          </>
        )}
        <SaveBar
          dirty={dirty}
          busy={busy}
          error={error}
          onReset={() => {
            setBrandId(initialBrand);
            setDetails(initialDetails);
          }}
        />
      </Form>
    </Panel>
  );
}

/* ─── Email server ─── */

function EmailSection({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const stored = project.email_settings ?? {};
  const initial = {
    smtp_host: stored.smtp_host ?? "",
    smtp_port: String(stored.smtp_port ?? 587),
    smtp_user: stored.smtp_user ?? "",
    from_name: stored.from_name ?? "",
    from_email: stored.from_email ?? "",
    reply_to: stored.reply_to ?? "",
    use_tls: stored.use_tls !== false,
  };
  const [form, setForm] = useState(initial);
  const [password, setPassword] = useState("");
  const { save, busy, error } = useSave(project, "Email server saved");
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || password !== "";
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const port = Number.parseInt(form.smtp_port, 10);
    const settings: EmailSettings = {
      smtp_host: form.smtp_host.trim(),
      smtp_port: Number.isFinite(port) ? port : 587,
      smtp_user: form.smtp_user.trim(),
      from_name: form.from_name.trim(),
      from_email: form.from_email.trim(),
      reply_to: form.reply_to.trim(),
      use_tls: form.use_tls,
    };
    if (password) settings.smtp_password = password;
    if (await save({ email_settings: settings })) setPassword("");
  };

  return (
    <Panel title="Email server" id="email">
      <Form onSubmit={() => void submit()} readOnly={readOnly}>
        <p style={{ fontSize: "var(--text-13)", color: "var(--ink-2)", maxWidth: "70ch" }}>
          Outbox emails for this project are sent through this SMTP server when you press Send. LaunchOps never sends automatically.
        </p>
        <FieldRow>
          <Field label="SMTP host">
            {(p) => <Input {...p} mono value={form.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.example.com" />}
          </Field>
          <Field label="Port" hint="STARTTLS on 587 is typical. Port 465 (implicit TLS) isn't supported.">
            {(p) => <Input {...p} mono inputMode="numeric" value={form.smtp_port} onChange={(e) => set("smtp_port", e.target.value.replace(/\D/g, ""))} />}
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Username">
            {(p) => <Input {...p} mono value={form.smtp_user} onChange={(e) => set("smtp_user", e.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Password" hint={stored.smtp_password_set ? "A password is saved. Leave blank to keep it." : "Stored for sending only; never shown again."}>
            {(p) => (
              <Input
                {...p}
                type="password"
                mono
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={stored.smtp_password_set ? "••••••••" : ""}
                autoComplete="new-password"
              />
            )}
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="From name" optional>
            {(p) => <Input {...p} value={form.from_name} onChange={(e) => set("from_name", e.target.value)} />}
          </Field>
          <Field label="From address" optional hint="Defaults to the username.">
            {(p) => <Input {...p} type="email" mono value={form.from_email} onChange={(e) => set("from_email", e.target.value)} />}
          </Field>
        </FieldRow>
        <Field label="Reply-to" optional>
          {(p) => <Input {...p} type="email" mono value={form.reply_to} onChange={(e) => set("reply_to", e.target.value)} />}
        </Field>
        <SwitchField label="Use STARTTLS" checked={form.use_tls} onCheckedChange={(v) => set("use_tls", v)} />
        <SaveBar
          dirty={dirty}
          busy={busy}
          error={error}
          onReset={() => {
            setForm(initial);
            setPassword("");
          }}
        />
      </Form>
    </Panel>
  );
}

/* ─── Danger zone ─── */

function DangerSection({ project }: { project: Project }) {
  const remove = useDeleteProject();
  const canDelete = useOrganisation().can("owner");
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  return (
    <Panel title="Delete project">
      <FieldStack>
        <p style={{ fontSize: "var(--text-13)", color: "var(--ink-2)" }}>
          Deletes the project with its reports, launch plan, review results, Outbox emails, calendar entries and ideas. Templates are kept. This can't
          be undone.
        </p>
        {canDelete ? (
          <div>
            <Button variant="dangerGhost" onClick={() => setOpen(true)}>
              Delete {project.name}…
            </Button>
          </div>
        ) : (
          <RoleNote action="Deleting a project" minimum="owner" />
        )}
      </FieldStack>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setConfirmText("");
        }}
        title={`Delete ${project.name}?`}
        description="Everything that belongs to this project is removed permanently."
        confirmLabel="Delete project"
        destructive
        busy={remove.isPending}
        disabled={confirmText.trim() !== project.name.trim()}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(project.id);
            toast.show({ title: `${project.name} deleted` });
            navigate(routes.portfolio);
          } catch (err) {
            toast.show({ title: "Project not deleted", description: errorMessage(err), tone: "crit" });
          }
        }}
      >
        <Field label={`Type ${project.name} to confirm`}>
          {(p) => <Input {...p} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}
        </Field>
      </ConfirmDialog>
    </Panel>
  );
}
