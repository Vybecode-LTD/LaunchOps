import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { errorMessage } from "@/lib/api/client";
import type { Project, PricingResult, RepurposeResult } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useOperations, type PressContacts, type ReportInput } from "@/lib/operations/OperationsProvider";
import { useCreateTemplate, useLaunchWorkflow, useSettings, useTemplatesFor } from "@/lib/queries/hooks";
import { useNow } from "@/lib/hooks/useClock";
import { CATEGORY_LABELS, type OperationDef } from "@/lib/domain/operations";
import { CHANNELS, DEFAULT_CHANNELS, channelName, composeLink } from "@/lib/domain/channels";
import { formatTimestamp } from "@/lib/domain/dates";
import { hasReport } from "@/lib/domain/projects";
import { list, midSentence, text } from "@/lib/domain/values";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, FieldRow, FieldStack, Input, Textarea } from "@/components/ui/Field";
import { CopyButton, Notice, Segmented } from "@/components/ui/Display";
import { Sheet } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/toast";
import { RoleNote } from "@/components/access/Access";
import styles from "@/pages/project/ProjectPages.module.css";

interface RunSheetProps {
  op: OperationDef | null;
  project: Project;
  onOpenChange: (open: boolean) => void;
  /** Idea text to prefill as instructions or content. */
  seedText?: string;
}

export function RunSheet({ op, project, onOpenChange, seedText }: RunSheetProps) {
  return (
    <Sheet
      open={Boolean(op)}
      onOpenChange={onOpenChange}
      title={op ? `Run ${midSentence(op.name)}` : "Run operation"}
      description={op ? `${CATEGORY_LABELS[op.category]} · ${project.name}` : undefined}
      wide={op?.id === "repurpose" || op?.id === "press_release"}
    >
      {op && <RunForm key={op.id} op={op} project={project} seedText={seedText} onDone={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function Contract({ op, project }: { op: OperationDef; project: Project }) {
  const existing = op.reportKey ? (project[op.reportKey] as { generated_at?: string } | null | undefined) : null;
  const uses = [
    "the project profile and company details",
    op.webResearch ? "live web research" : null,
    op.readsPage ? "the web page you enter below" : null,
  ].filter(Boolean);
  const result =
    op.kind === "workflow"
      ? "Runs in the background and lands in Review, where you approve or reject it."
      : op.kind === "report"
        ? hasReport(existing)
          ? `Saved to Reports, replacing the current version${existing?.generated_at ? ` from ${formatTimestamp(existing.generated_at)}` : ""}.`
          : "Saved to this project's Reports."
        : "Shown in this panel. Not saved unless you save a version as a template.";
  return (
    <dl className={styles.contract}>
      <dt>Produces</dt>
      <dd>{op.produces}</dd>
      <dt>Uses</dt>
      <dd>{uses.join(", ").replace(/^\w/, (c) => c.toUpperCase())}.</dd>
      <dt>Result</dt>
      <dd>{result}</dd>
      {op.kind !== "tool" && (
        <>
          <dt>If it fails</dt>
          <dd>
            {op.kind === "workflow"
              ? "After a temporary problem, such as an AI provider error, it tries again by itself, up to 3 attempts. If it still fails, Review says why and you can run it again."
              : "You see why here, and any saved version of the report is kept."}
          </dd>
        </>
      )}
      {op.draftsEmailsOnApproval && (
        <>
          <dt>On approval</dt>
          <dd>Email addresses found in the result are copied to the Outbox as drafts. Nothing is sent until you press Send.</dd>
        </>
      )}
    </dl>
  );
}

function RunForm({ op, project, seedText, onDone }: { op: OperationDef; project: Project; seedText?: string; onDone: () => void }) {
  const canRun = useOrganisation().can("editor");
  if (!canRun) {
    // What the operation does stays readable; running it needs the Editor role.
    return (
      <FieldStack>
        <Contract op={op} project={project} />
        <RoleNote action="Running this operation" minimum="editor" />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onDone}>
            Close panel
          </Button>
        </div>
      </FieldStack>
    );
  }
  if (op.kind === "workflow") return <WorkflowForm op={op} project={project} seedText={seedText} onDone={onDone} />;
  if (op.kind === "tool") return <RepurposeForm op={op} project={project} seedText={seedText} />;
  return <ReportForm op={op} project={project} seedText={seedText} onDone={onDone} />;
}

/* ─── Workflows → Review ─── */

function WorkflowForm({ op, project, seedText, onDone }: { op: OperationDef; project: Project; seedText?: string; onDone: () => void }) {
  const [instructions, setInstructions] = useState(seedText ?? "");
  const [error, setError] = useState<string | null>(null);
  const launch = useLaunchWorkflow();
  const templates = useTemplatesFor(op.id);
  const settings = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const inUse = Object.entries(settings.data?.platforms ?? {})
    .filter(([, cfg]) => cfg.connected)
    .map(([id]) => channelName(id));

  const submit = async () => {
    setError(null);
    try {
      const response = await launch.mutateAsync({ productId: project.id, workflowId: op.id, instructions: instructions.trim() });
      toast.show({
        title: `${op.name} started`,
        description: "The result will appear in Review.",
        tone: "info",
        action: { label: "View", onClick: () => navigate(routes.projectReview(project.id, response.task_id)) },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <FieldStack>
      <Contract op={op} project={project} />
      {op.id === "social_posts" && (
        <Notice>
          {inUse.length
            ? `Posts will be written for the channels marked In use: ${inUse.join(", ")}.`
            : "No channels are marked In use, so posts will be written for X, LinkedIn and Instagram."}{" "}
          <Link to={routes.settings("channels")}>Change channels</Link>
        </Notice>
      )}
      <Field label="Instructions" optional hint="Added to the request as additional instructions, e.g. an angle, audience or tone to focus on.">
        {(props) => (
          <Textarea {...props} value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={5} placeholder="Focus on podcast producers in Europe…" />
        )}
      </Field>
      {(templates.data?.length ?? 0) > 0 && (
        <div>
          <div className="placard" style={{ marginBottom: 8 }}>
            Templates tagged for this operation
          </div>
          <div className={styles.templateList}>
            {templates.data!.map((t) => (
              <div key={t.id} className={styles.templateItem}>
                <span className={styles.templateName}>{t.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setInstructions((current) => (current.trim() ? `${current.trim()}\n\n${t.content}` : t.content))}
                >
                  Add to instructions
                  <span className="sr-only">: {t.name}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <Notice tone="crit">{error}</Notice>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" loading={launch.isPending} onClick={() => void submit()}>
          Run {midSentence(op.name)}
        </Button>
      </div>
    </FieldStack>
  );
}

/* ─── Reports → project ─── */

function pricingSummary(pricing: PricingResult | null | undefined): string {
  const tiers = list<{ name?: string; price?: string }>(pricing?.tiers);
  return tiers
    .map((t) => `${text(t.name) || "Tier"} (${text(t.price) || "no price"})`)
    .join(", ");
}

function ReportForm({ op, project, seedText, onDone }: { op: OperationDef; project: Project; seedText?: string; onDone: () => void }) {
  const ops = useOperations();
  const now = useNow(1000);
  const [url, setUrl] = useState(project.url ?? "");
  const [notes, setNotes] = useState(seedText ?? "");
  const savedPricing = hasReport(project.pricing_result);
  const [pricingMode, setPricingMode] = useState<"saved" | "custom">(savedPricing ? "saved" : "custom");
  const [customPricing, setCustomPricing] = useState("");
  const [contacts, setContacts] = useState<PressContacts>({ additional_notes: seedText ?? "" });
  const [error, setError] = useState<string | null>(null);
  const runningEntry = ops.running.find((r) => r.operationId === op.id && r.projectId === project.id);

  const input = (): ReportInput | null => {
    switch (op.id) {
      case "market_analysis":
        return { operationId: "market_analysis", customPricing: pricingMode === "custom" ? customPricing.trim() : "" };
      case "pricing":
        return { operationId: "pricing", notes: notes.trim() };
      case "press_kit":
        return { operationId: "press_kit", url: url.trim() };
      case "press_release":
        return { operationId: "press_release", url: url.trim(), contacts };
      case "seo":
        return { operationId: "seo", url: url.trim() };
      default:
        return null;
    }
  };

  const needsUrl = op.readsPage;
  const urlValid = !needsUrl || /^https?:\/\/\S+\.\S+/.test(url.trim());

  const submit = async () => {
    const payload = input();
    if (!payload) return;
    setError(null);
    try {
      await ops.runReport(project, payload);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const setContact = (key: keyof PressContacts) => (value: string) => setContacts((c) => ({ ...c, [key]: value }));

  if (runningEntry) {
    const seconds = Math.max(0, Math.round((now - runningEntry.startedAt) / 1000));
    return (
      <FieldStack>
        <Contract op={op} project={project} />
        <div className={styles.elapsed} role="status">
          <span className="placard">Running</span>
          <span className={styles.elapsedTime}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
          <span>
            {op.webResearch ? "Web research can take a few minutes. " : ""}Keep LaunchOps open until it finishes. You can close this panel;
            you'll get a notification when the report is saved.
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onDone}>
            Close panel
          </Button>
        </div>
      </FieldStack>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <FieldStack>
        <Contract op={op} project={project} />

        {needsUrl && (
          <Field
            label="Page to read"
            hint="The page's title, description, headings and first 3,000 characters of text are sent with the request."
            error={url && !urlValid ? "Enter a full address starting with https://" : null}
          >
            {(props) => <Input {...props} type="url" mono value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" required />}
          </Field>
        )}

        {op.id === "pricing" && (
          <Field label="Notes" optional hint="Costs, margins, constraints or positioning the model should consider.">
            {(props) => <Textarea {...props} value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />}
          </Field>
        )}

        {op.id === "market_analysis" && (
          <>
            <div>
              <div className="placard" style={{ marginBottom: 8 }}>
                Pricing for revenue projections
              </div>
              <Segmented<"saved" | "custom">
                label="Pricing source"
                value={pricingMode}
                onChange={setPricingMode}
                options={[
                  { value: "saved", label: savedPricing ? "Saved pricing strategy" : "Estimate from research" },
                  { value: "custom", label: "Enter pricing" },
                ]}
              />
            </div>
            {pricingMode === "saved" && savedPricing && (
              <Notice>Uses the tiers from this project's pricing strategy: {pricingSummary(project.pricing_result) || "no tiers listed"}.</Notice>
            )}
            {pricingMode === "saved" && !savedPricing && (
              <Notice>No pricing strategy is saved for this project, so the model estimates pricing from its market research.</Notice>
            )}
            {pricingMode === "custom" && (
              <Field label="Your pricing" hint="Used instead of any saved pricing strategy.">
                {(props) => (
                  <Textarea
                    {...props}
                    value={customPricing}
                    onChange={(e) => setCustomPricing(e.target.value)}
                    rows={3}
                    placeholder="Free tier; Pro $29/month; Team $99/month"
                    required
                  />
                )}
              </Field>
            )}
          </>
        )}

        {op.id === "press_release" && (
          <>
            {/* The contacts' fields share their names, so each contact is a group its fields are announced within. */}
            <fieldset className={styles.fieldGroup}>
              <legend className="placard">Media contact</legend>
              <FieldRow>
                <Field label="Name" optional>
                  {(props) => <Input {...props} value={contacts.media_contact_name ?? ""} onChange={(e) => setContact("media_contact_name")(e.target.value)} />}
                </Field>
                <Field label="Email" optional>
                  {(props) => <Input {...props} type="email" value={contacts.media_contact_email ?? ""} onChange={(e) => setContact("media_contact_email")(e.target.value)} />}
                </Field>
                <Field label="Phone" optional>
                  {(props) => <Input {...props} value={contacts.media_contact_phone ?? ""} onChange={(e) => setContact("media_contact_phone")(e.target.value)} />}
                </Field>
              </FieldRow>
            </fieldset>
            {!contacts.media_contact_name?.trim() && !contacts.technical_contact_name?.trim() && !contacts.sales_contact_name?.trim() && (
              <Notice tone="warn">With no contact names, the release is written with placeholder contact names you'll need to replace.</Notice>
            )}
            <fieldset className={styles.fieldGroup}>
              <legend className="placard">Technical contact</legend>
              <FieldRow>
                <Field label="Name" optional>
                  {(props) => <Input {...props} value={contacts.technical_contact_name ?? ""} onChange={(e) => setContact("technical_contact_name")(e.target.value)} />}
                </Field>
                <Field label="Email" optional>
                  {(props) => <Input {...props} type="email" value={contacts.technical_contact_email ?? ""} onChange={(e) => setContact("technical_contact_email")(e.target.value)} />}
                </Field>
              </FieldRow>
            </fieldset>
            <fieldset className={styles.fieldGroup}>
              <legend className="placard">Sales contact</legend>
              <FieldRow>
                <Field label="Name" optional>
                  {(props) => <Input {...props} value={contacts.sales_contact_name ?? ""} onChange={(e) => setContact("sales_contact_name")(e.target.value)} />}
                </Field>
                <Field label="Email" optional>
                  {(props) => <Input {...props} type="email" value={contacts.sales_contact_email ?? ""} onChange={(e) => setContact("sales_contact_email")(e.target.value)} />}
                </Field>
              </FieldRow>
            </fieldset>
            <Field label="Angle and details" optional hint="A news hook, figures, quotes or anything else the release must include.">
              {(props) => (
                <Textarea {...props} value={contacts.additional_notes ?? ""} onChange={(e) => setContact("additional_notes")(e.target.value)} rows={3} />
              )}
            </Field>
          </>
        )}

        {error && <Notice tone="crit">{error}</Notice>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!urlValid || (op.id === "market_analysis" && pricingMode === "custom" && !customPricing.trim())}
          >
            Run {midSentence(op.name)}
          </Button>
        </div>
      </FieldStack>
    </form>
  );
}

/* ─── Repurpose (tool) ─── */

function RepurposeForm({ op, project, seedText }: { op: OperationDef; project: Project; seedText?: string }) {
  const ops = useOperations();
  const settings = useSettings();
  const createTemplate = useCreateTemplate();
  const toast = useToast();
  const inUse = Object.entries(settings.data?.platforms ?? {})
    .filter(([, cfg]) => cfg.connected)
    .map(([id]) => id);
  const [content, setContent] = useState(seedText ?? "");
  const [selected, setSelected] = useState<string[] | null>(null);
  const channels = selected ?? (inUse.length ? inUse : DEFAULT_CHANNELS);
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = ops.isRunning("repurpose", project.id);

  const toggle = (id: string, on: boolean) => setSelected(on ? [...new Set([...channels, id])] : channels.filter((c) => c !== id));

  const submit = async () => {
    setError(null);
    setResult(null);
    try {
      setResult(await ops.repurpose(project, content.trim(), channels));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const outputs = list<{ platform?: string; content?: string; hashtags?: string[] | string; notes?: string; character_count?: number }>(result?.platforms);

  return (
    <FieldStack>
      <Contract op={op} project={project} />
      <Field label="Content to repurpose" hint="An announcement, update or idea — written once.">
        {(props) => <Textarea {...props} value={content} onChange={(e) => setContent(e.target.value)} rows={6} />}
      </Field>
      <fieldset className={styles.fieldGroup}>
        <legend className="placard">Channels</legend>
        <div className={styles.channelGrid}>
          {CHANNELS.map((c) => (
            <Checkbox key={c.id} label={c.name} checked={channels.includes(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
          ))}
        </div>
      </fieldset>
      {error && <Notice tone="crit">{error}</Notice>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" loading={running} disabled={!content.trim() || channels.length === 0} onClick={() => void submit()}>
          {result ? "Repurpose again" : "Repurpose"}
        </Button>
      </div>

      {outputs.length > 0 && (
        <div className={styles.repurposeResults} aria-live="polite">
          {outputs.map((out, i) => {
            const hashtags = Array.isArray(out.hashtags) ? out.hashtags.join(" ") : text(out.hashtags);
            const full = [text(out.content), hashtags].filter(Boolean).join("\n\n");
            const compose = composeLink(out.platform, full, project.url);
            return (
              <article key={`${out.platform}-${i}`} className={styles.repurposeCard}>
                <header className={styles.repurposeHead}>
                  <strong>{channelName(out.platform)}</strong>
                  <span className="placard num">{full.length} characters</span>
                </header>
                <div className={styles.repurposeBody}>{text(out.content)}</div>
                {hashtags && <div className={styles.hashtags}>{hashtags}</div>}
                {out.notes && <div className={styles.hashtags} style={{ color: "var(--ink-3)" }}>{text(out.notes)}</div>}
                <footer className={styles.repurposeFoot}>
                  <CopyButton value={full} label="Copy text" variant="secondary" />
                  {compose && (
                    <Button asChild size="sm" variant="ghost">
                      <a href={compose.href} target="_blank" rel="noopener noreferrer" title={compose.prefillsText ? "Opens with this text filled in" : "Copy the text first — this shares the link only"}>
                        {compose.label}
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={createTemplate.isPending}
                    onClick={async () => {
                      try {
                        await createTemplate.mutateAsync({
                          name: `${channelName(out.platform)} post — ${project.name}`,
                          type: "social",
                          tags: op.templateTags,
                          content: full,
                          source_product: project.name,
                        });
                        toast.show({ title: "Saved to templates" });
                      } catch (err) {
                        toast.show({ title: "Template not saved", description: errorMessage(err), tone: "crit" });
                      }
                    }}
                  >
                    Save as template
                  </Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </FieldStack>
  );
}
