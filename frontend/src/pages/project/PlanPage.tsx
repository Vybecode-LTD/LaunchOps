import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useOrganisation } from "@/lib/auth/organisation";
import { useUpdateChecklist } from "@/lib/queries/hooks";
import { useToday } from "@/lib/hooks/useClock";
import { PLAN_PHASES, addCustomItem, phaseItems, planProgress, removeCustomItem, setChecked, type PhaseDef } from "@/lib/domain/checklist";
import { formatDateKey } from "@/lib/domain/dates";
import { daysToLaunch, describeDays } from "@/lib/domain/projects";
import { Button, IconButton, cx } from "@/components/ui/Button";
import { Meter } from "@/components/ui/Display";
import { CheckboxInput, Input } from "@/components/ui/Field";
import { ViewOnlyFieldset, ViewOnlyNotice } from "@/components/access/Access";
import { useProjectContext } from "./projectContext";
import styles from "./ProjectPages.module.css";

export function PlanPage() {
  const project = useProjectContext();
  const today = useToday();
  const update = useUpdateChecklist(project.id);
  const canEdit = useOrganisation().can("editor");
  const checklist = project.checklist ?? {};
  const progress = planProgress(checklist);
  const days = daysToLaunch(project, today);

  return (
    <>
      {!canEdit && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <ViewOnlyNotice action="Ticking items or adding your own">You can view the launch plan.</ViewOnlyNotice>
        </div>
      )}
      <div className={styles.planHead}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="placard">Launch plan</span>
          <p style={{ color: "var(--ink-2)", maxWidth: "70ch" }}>
            {progress.done} of {progress.total} items done.{" "}
            {project.launch_date ? `${describeDays(days)} — launch day is ${formatDateKey(project.launch_date, "long")}.` : "Set a launch date on the Overview tab to schedule launch day."}
          </p>
        </div>
        <div style={{ width: 260 }}>
          <Meter value={progress.total ? (progress.done / progress.total) * 100 : 0} label="Launch plan progress" size="lg" />
        </div>
      </div>
      <ViewOnlyFieldset readOnly={!canEdit}>
        <div className={styles.phases}>
          {PLAN_PHASES.map((def) => (
            <Phase
              key={def.phase}
              def={def}
              checklist={checklist}
              onChange={(next) => update.mutate(next)}
              launchDate={project.launch_date}
              canEdit={canEdit}
            />
          ))}
        </div>
      </ViewOnlyFieldset>
    </>
  );
}

function Phase({
  def,
  checklist,
  onChange,
  launchDate,
  canEdit,
}: {
  def: PhaseDef;
  checklist: Record<string, boolean | string[] | undefined>;
  onChange: (next: Record<string, boolean | string[] | undefined>) => void;
  launchDate?: string | null;
  /** Without the Editor role, items can't be ticked, added or removed. */
  canEdit: boolean;
}) {
  const items = phaseItems(checklist, def);
  const done = items.filter((i) => i.checked).length;
  const [draft, setDraft] = useState("");
  const hasTimes = items.some((i) => i.time);

  return (
    <section className={styles.phase} aria-labelledby={`phase-${def.phase}`}>
      <header className={styles.phaseHead}>
        <h2 className={styles.phaseTitle} id={`phase-${def.phase}`}>
          {def.label}
          <span className="placard num">
            {done}/{items.length}
          </span>
          {def.phase === "Launch Day" && launchDate && <span className="placard">{formatDateKey(launchDate, "weekday")}</span>}
        </h2>
        <div className={styles.phaseProgress}>
          <Meter value={items.length ? (done / items.length) * 100 : 0} label={`${def.label} progress`} />
        </div>
      </header>
      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.key} className={cx(styles.item, !hasTimes && styles.itemNoTime, item.checked && styles.itemDone)}>
            <CheckboxInput id={item.key} checked={item.checked} onChange={(e) => onChange(setChecked(checklist, item.key, e.target.checked))} />
            {hasTimes && <span className={styles.itemTime}>{item.time ?? ""}</span>}
            <label htmlFor={item.key} className={styles.itemLabel}>
              {item.label}
            </label>
            {canEdit && item.custom && item.customIndex !== undefined ? (
              <IconButton size="sm" label={`Remove "${item.label}"`} onClick={() => onChange(removeCustomItem(checklist, def, item.customIndex!))}>
                <Trash2 aria-hidden="true" />
              </IconButton>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className={styles.addItem}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onChange(addCustomItem(checklist, def.phase, draft));
            setDraft("");
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add an item to ${def.label.toLowerCase()}`} aria-label={`New ${def.label} item`} />
          <Button type="submit" variant="secondary" disabled={!draft.trim()}>
            Add
          </Button>
        </form>
      )}
    </section>
  );
}
