import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import type { Brand, BrandInput } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useBrands, useDeleteBrand, useProjects, useSaveBrand } from "@/lib/queries/hooks";
import { Button } from "@/components/ui/Button";
import { EmptyState, Notice, Panel, Skeleton } from "@/components/ui/Display";
import { Field, FieldRow, FieldStack, Input, Select, TagInput, Textarea } from "@/components/ui/Field";
import { ConfirmDialog, Sheet } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/toast";
import { ViewOnlyFieldset, ViewOnlyNotice } from "@/components/access/Access";
import styles from "./Settings.module.css";

export function CompaniesSettings() {
  const brands = useBrands();
  const projects = useProjects();
  const remove = useDeleteBrand();
  const toast = useToast();
  // Creating, editing and deleting company profiles need the Editor role.
  const canEdit = useOrganisation().can("editor");
  const [editing, setEditing] = useState<Brand | "new" | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);

  const usage = (id: string) => (projects.data ?? []).filter((p) => p.brand_id === id);

  return (
    <div className={styles.stack} style={{ maxWidth: "none" }}>
      {!canEdit && <ViewOnlyNotice action="Adding or changing them">You can view the company profiles.</ViewOnlyNotice>}
      <Panel
        title="Companies"
        actions={
          canEdit && (
            <Button variant="primary" size="sm" icon={<Plus aria-hidden="true" />} onClick={() => setEditing("new")}>
              New company
            </Button>
          )
        }
      >
        <FieldStack>
          <p className={styles.lede}>
            A company profile holds the legal name, people, contact details, boilerplate and voice used in press materials. Assign it to any number of
            projects from each project's settings.
          </p>
          {brands.isLoading ? (
            <Skeleton height={120} />
          ) : (brands.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Building2 aria-hidden="true" />}
              title="No companies yet"
              action={
                canEdit && (
                  <Button variant="secondary" onClick={() => setEditing("new")}>
                    Create a company
                  </Button>
                )
              }
            >
              Without one, each project uses the company details entered in its own settings.
            </EmptyState>
          ) : (
            <div className={styles.companies}>
              {(brands.data ?? []).map((b) => {
                const used = usage(b.id);
                return (
                  <article key={b.id} className={styles.company}>
                    <h3 className={styles.companyName}>{b.name}</h3>
                    <div className={styles.companyMeta}>{[b.industry, b.location].filter(Boolean).join(" · ") || "No industry or location"}</div>
                    {b.founder_name && (
                      <div className={styles.companyMeta}>
                        {b.founder_name}
                        {b.founder_title ? ` — ${b.founder_title}` : ""}
                      </div>
                    )}
                    <div className="placard">
                      {used.length ? `Used by ${used.length} project${used.length === 1 ? "" : "s"}` : "Not assigned to a project"}
                    </div>
                    <div className={styles.companyActions}>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>
                        {canEdit ? "Edit" : "View"}
                      </Button>
                      {canEdit && (
                        <Button size="sm" variant="dangerGhost" onClick={() => setDeleting(b)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </FieldStack>
      </Panel>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "New company" : `${canEdit ? "Edit" : "View"} ${editing?.name ?? "company"}`}
        description="Used in press kits, press releases and every operation for projects it's assigned to."
        wide
      >
        {editing !== null && (
          <CompanyForm
            key={editing === "new" ? "new" : editing.id}
            brand={editing === "new" ? null : editing}
            readOnly={!canEdit}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "company"}?`}
        description={
          deleting && usage(deleting.id).length
            ? `${usage(deleting.id).length} project${usage(deleting.id).length === 1 ? " uses" : "s use"} it. They will fall back to the company details in their own settings.`
            : "No projects use it."
        }
        confirmLabel="Delete company"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.show({ title: `${deleting.name} deleted` });
            setDeleting(null);
          } catch (err) {
            toast.show({ title: "Company not deleted", description: errorMessage(err), tone: "crit" });
          }
        }}
      />
    </div>
  );
}

const EMPTY: BrandInput = {
  name: "",
  industry: "",
  location: "",
  founded: "",
  company_size: "",
  founder_name: "",
  founder_title: "",
  email: "",
  phone: "",
  tagline: "",
  tone: "professional",
  keywords: [],
  avoid: [],
  elevator: "",
  boilerplate: "",
  logo_url: "",
};

function CompanyForm({ brand, readOnly, onDone }: { brand: Brand | null; readOnly: boolean; onDone: () => void }) {
  const save = useSaveBrand();
  const toast = useToast();
  const [form, setForm] = useState<BrandInput>(() => {
    if (!brand) return EMPTY;
    const picked: BrandInput = {};
    for (const key of Object.keys(EMPTY) as Array<keyof BrandInput>) {
      (picked as Record<string, unknown>)[key] = brand[key as keyof Brand] ?? EMPTY[key];
    }
    return picked;
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof BrandInput>(key: K, value: BrandInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const str = (key: keyof BrandInput) => (form[key] as string | undefined) ?? "";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await save.mutateAsync({ id: brand?.id, data: { ...form, name: str("name").trim() } });
          toast.show({ title: brand ? "Company saved" : "Company created" });
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <FieldStack>
        {readOnly && <ViewOnlyNotice action="Changing it">You can view this company profile.</ViewOnlyNotice>}
        <ViewOnlyFieldset readOnly={readOnly}>
          <section className={styles.formSection}>
            <div className="placard">Identity</div>
            <FieldRow>
              <Field label="Company name">{(p) => <Input {...p} value={str("name")} onChange={(e) => set("name", e.target.value)} required autoFocus />}</Field>
              <Field label="Industry" optional>
                {(p) => <Input {...p} value={str("industry")} onChange={(e) => set("industry", e.target.value)} />}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Location" optional>
                {(p) => <Input {...p} value={str("location")} onChange={(e) => set("location", e.target.value)} placeholder="City, region" />}
              </Field>
              <Field label="Founded" optional>
                {(p) => <Input {...p} value={str("founded")} onChange={(e) => set("founded", e.target.value)} placeholder="2024" />}
              </Field>
              <Field label="Company size" optional>
                {(p) => <Input {...p} value={str("company_size")} onChange={(e) => set("company_size", e.target.value)} placeholder="11–50 employees" />}
              </Field>
            </FieldRow>
          </section>

          <section className={styles.formSection}>
            <div className="placard">People and contact</div>
            <FieldRow>
              <Field label="Founders" optional hint="Separate several names with commas.">
                {(p) => <Input {...p} value={str("founder_name")} onChange={(e) => set("founder_name", e.target.value)} />}
              </Field>
              <Field label="Titles" optional hint="In the same order as the names.">
                {(p) => <Input {...p} value={str("founder_title")} onChange={(e) => set("founder_title", e.target.value)} placeholder="CEO, CTO" />}
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Press email" optional>
                {(p) => <Input {...p} type="email" value={str("email")} onChange={(e) => set("email", e.target.value)} />}
              </Field>
              <Field label="Phone" optional>
                {(p) => <Input {...p} value={str("phone")} onChange={(e) => set("phone", e.target.value)} />}
              </Field>
            </FieldRow>
          </section>

          <section className={styles.formSection}>
            <div className="placard">Voice</div>
            <FieldRow>
              <Field label="Tagline" optional>
                {(p) => <Input {...p} value={str("tagline")} onChange={(e) => set("tagline", e.target.value)} />}
              </Field>
              <Field label="Tone" optional>
                {(p) => (
                  <Select {...p} value={str("tone")} onChange={(e) => set("tone", e.target.value)}>
                    <option value="professional">Professional</option>
                    <option value="creative">Creative and empowering</option>
                    <option value="edgy">Edgy and bold</option>
                    <option value="casual">Casual</option>
                    <option value="technical">Technical</option>
                  </Select>
                )}
              </Field>
            </FieldRow>
            <Field label="Elevator pitch" optional>
              {(p) => <Textarea {...p} value={str("elevator")} onChange={(e) => set("elevator", e.target.value)} rows={3} />}
            </Field>
            <FieldRow>
              <Field label="Keywords" optional>
                {(p) => <TagInput id={p.id} value={form.keywords ?? []} onChange={(v) => set("keywords", v)} />}
              </Field>
              <Field label="Phrases to avoid" optional>
                {(p) => <TagInput id={p.id} value={form.avoid ?? []} onChange={(v) => set("avoid", v)} />}
              </Field>
            </FieldRow>
          </section>

          <section className={styles.formSection}>
            <div className="placard">Press</div>
            <Field label="Boilerplate" optional hint="The “About” paragraph at the end of press releases.">
              {(p) => <Textarea {...p} value={str("boilerplate")} onChange={(e) => set("boilerplate", e.target.value)} rows={5} />}
            </Field>
          </section>
        </ViewOnlyFieldset>

        {error && <Notice tone="crit">{error}</Notice>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {readOnly ? (
            <Button variant="secondary" onClick={onDone}>
              Close panel
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onDone}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={save.isPending} disabled={!str("name").trim()}>
                {brand ? "Save company" : "Create company"}
              </Button>
            </>
          )}
        </div>
      </FieldStack>
    </form>
  );
}
