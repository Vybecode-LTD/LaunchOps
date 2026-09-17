import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { FileText, Lightbulb, Plus, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import { capturesApi, templatesApi } from "@/lib/api/endpoints";
import type { Template } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useCaptures, useCreateTemplate, useProjects, useTemplates, useUndoableDelete } from "@/lib/queries/hooks";
import { keys } from "@/lib/queries/keys";
import { useNow } from "@/lib/hooks/useClock";
import { formatTimestamp, relativeTime } from "@/lib/domain/dates";
import { routes } from "@/lib/routes";
import { Button, IconButton } from "@/components/ui/Button";
import { CopyButton, EmptyState, Notice, PageHeader, Panel, Segmented } from "@/components/ui/Display";
import { Markdown } from "@/components/ui/Markdown";
import { Field, FieldRow, FieldStack, Input, Select, TagInput, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/toast";
import { ProjectSwatch } from "@/components/project/ProjectBits";
import { RoleRequirement } from "@/components/access/Access";
import { useShell } from "@/components/shell/shellContext";
import styles from "./LibraryPage.module.css";

type Tab = "templates" | "ideas";

const TEMPLATE_TAGS = ["research", "outreach", "email", "social", "content", "ads", "blog", "community"];

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "ideas" ? "ideas" : "templates";
  const templates = useTemplates();
  const captures = useCaptures();

  return (
    <>
      <PageHeader
        title="Library"
        lede="Reusable templates and captured ideas, shared across every project."
        actions={
          <Segmented<Tab>
            label="Library section"
            value={tab}
            onChange={(t) => setParams(t === "templates" ? {} : { tab: t }, { replace: true })}
            options={[
              { value: "templates", label: `Templates · ${templates.data?.length ?? 0}` },
              { value: "ideas", label: `Ideas · ${captures.data?.length ?? 0}` },
            ]}
          />
        }
      />
      {tab === "templates" ? <Templates /> : <Ideas />}
    </>
  );
}

function Templates() {
  const templates = useTemplates();
  const remove = useUndoableDelete();
  // Saving and deleting templates need the Editor role.
  const canEdit = useOrganisation().can("editor");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const list = (templates.data ?? []).filter((t) => !filter || (t.tags ?? []).includes(filter));
  const selected = list.find((t) => t.id === selectedId) ?? list[0] ?? null;

  return (
    <div className={styles.layout}>
      <Panel
        title="Templates"
        flush
        actions={
          canEdit && (
            <Button size="sm" variant="secondary" icon={<Plus aria-hidden="true" />} onClick={() => setCreating(true)}>
              New
            </Button>
          )
        }
      >
        <div className={styles.filterRow}>
          <Select aria-label="Filter by tag" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All tags</option>
            {TEMPLATE_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<FileText aria-hidden="true" />} title="No templates">
            {canEdit ? (
              "Save a review result or a repurposed post as a template, or write one yourself. Templates tagged for an operation are offered when you run it."
            ) : (
              <RoleRequirement action="Adding templates" minimum="editor" />
            )}
          </EmptyState>
        ) : (
          <ul className={styles.list}>
            {list.map((t) => (
              <li key={t.id}>
                <button type="button" className={styles.item} aria-pressed={selected?.id === t.id} onClick={() => setSelectedId(t.id)}>
                  <span className={styles.itemName}>{t.name}</span>
                  <span className={styles.itemMeta}>
                    {t.type}
                    {t.source_product ? ` · ${t.source_product}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={selected?.name ?? "Template"}
        actions={
          selected && (
            <>
              <CopyButton value={selected.content} label="Copy" variant="secondary" />
              {canEdit && (
                <IconButton
                  variant="dangerGhost"
                  label="Delete template"
                  onClick={() => {
                    remove({ id: selected.id, noun: "Template", listKeys: [keys.templates(), ["templates", "for"]], remove: templatesApi.remove });
                    setSelectedId(null);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              )}
            </>
          )
        }
      >
        {selected ? <TemplatePreview template={selected} /> : <EmptyState title="Select a template">Its content appears here.</EmptyState>}
      </Panel>

      <Modal open={creating} onOpenChange={setCreating} title="New template" description="Tags decide which operations offer this template." wide>
        {creating && <TemplateForm onDone={() => setCreating(false)} />}
      </Modal>
    </div>
  );
}

function TemplatePreview({ template }: { template: Template }) {
  return (
    <FieldStack>
      <div className={styles.tags}>
        {(template.tags ?? []).map((tag) => (
          <Pill key={tag} tone="outline" dot={false}>
            {tag}
          </Pill>
        ))}
        <span className={styles.itemMeta}>Saved {formatTimestamp(template.created_at)}</span>
      </div>
      <Markdown compact>{template.content}</Markdown>
    </FieldStack>
  );
}

function TemplateForm({ onDone }: { onDone: () => void }) {
  const create = useCreateTemplate();
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("content");
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await create.mutateAsync({ name: name.trim(), type, tags, content });
          toast.show({ title: "Template saved" });
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <FieldStack>
        <FieldRow>
          <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />}</Field>
          <Field label="Type">
            {(p) => (
              <Select {...p} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="content">Content</option>
                <option value="email">Email</option>
                <option value="social">Social</option>
                <option value="ads">Ads</option>
                <option value="research">Research</option>
              </Select>
            )}
          </Field>
        </FieldRow>
        <Field label="Tags" hint={`Operations look for: ${TEMPLATE_TAGS.join(", ")}.`}>
          {(p) => <TagInput id={p.id} value={tags} onChange={setTags} placeholder="outreach, email" />}
        </Field>
        <Field label="Content" hint="Markdown is supported.">
          {(p) => <Textarea {...p} value={content} onChange={(e) => setContent(e.target.value)} rows={10} required />}
        </Field>
        {error && <Notice tone="crit">{error}</Notice>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending} disabled={!name.trim() || !content.trim()}>
            Save template
          </Button>
        </div>
      </FieldStack>
    </form>
  );
}

function Ideas() {
  const captures = useCaptures();
  const projects = useProjects();
  const shell = useShell();
  const remove = useUndoableDelete();
  // Capturing and deleting ideas, and running operations from them, need the Editor role.
  const canEdit = useOrganisation().can("editor");
  const now = useNow();
  const ideas = captures.data ?? [];
  const projectOf = (id: string) => projects.data?.find((p) => p.id === id);

  return (
    <Panel
      title="Ideas"
      flush
      actions={
        canEdit && (
          <Button size="sm" variant="secondary" icon={<Lightbulb aria-hidden="true" />} onClick={() => shell.openCapture()}>
            Capture idea
          </Button>
        )
      }
    >
      {ideas.length === 0 ? (
        <EmptyState icon={<Lightbulb aria-hidden="true" />} title="No ideas yet">
          {canEdit ? (
            "Capture ideas from anywhere with the lightbulb in the top bar. Turn one into an operation when you're ready."
          ) : (
            <RoleRequirement action="Capturing ideas" minimum="editor" />
          )}
        </EmptyState>
      ) : (
        <ul className={styles.ideas}>
          {ideas.map((idea) => {
            const p = projectOf(idea.product_id);
            return (
              <li key={idea.id} className={styles.idea}>
                <div className={styles.ideaMain}>
                  <p className={styles.ideaText}>{idea.text}</p>
                  <span className={styles.itemMeta}>
                    {p && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <ProjectSwatch color={p.color} />
                        <Link to={routes.project(p.id)}>{p.name}</Link>
                      </span>
                    )}
                    {" · "}
                    {relativeTime(idea.created_at, now)}
                  </span>
                </div>
                {canEdit && (
                  <div className={styles.ideaActions}>
                    {p && (
                      <Button asChild size="sm" variant="secondary">
                        <Link to={`${routes.projectOperations(p.id)}?idea=${idea.id}`}>Use in an operation</Link>
                      </Button>
                    )}
                    <IconButton
                      size="sm"
                      variant="dangerGhost"
                      label="Delete idea"
                      onClick={() => remove({ id: idea.id, noun: "Idea", listKeys: [keys.captures()], remove: capturesApi.remove })}
                    >
                      <Trash2 aria-hidden="true" />
                    </IconButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
