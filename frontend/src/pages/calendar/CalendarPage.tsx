import { useState, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { CalendarClock, ChevronLeft, ChevronRight, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import { calendarApi } from "@/lib/api/endpoints";
import type { CalendarEvent, Project } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import {
  UNDO_WINDOW_MS,
  useCalendar,
  useCreateEvent,
  useProjects,
  useSetLaunchDate,
  useUndoableDelete,
  useUpdateEvent,
} from "@/lib/queries/hooks";
import { keys } from "@/lib/queries/keys";
import { useToday } from "@/lib/hooks/useClock";
import { CHANNELS, channelName } from "@/lib/domain/channels";
import { addDays, formatDateKey, formatMonth, formatWeekRange, monthGrid, monthStart, parseDateKey, weekDays } from "@/lib/domain/dates";
import { swatchColor } from "@/lib/domain/projects";
import { routes } from "@/lib/routes";
import { Button, IconButton, cx } from "@/components/ui/Button";
import { EmptyState, Notice, PageHeader, Panel, Segmented } from "@/components/ui/Display";
import { Field, FieldRow, FieldStack, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/toast";
import { RoleRequirement } from "@/components/access/Access";
import styles from "./CalendarPage.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Only drags that start on a calendar entry carry this type; files and text dragged in are ignored. */
const DRAG_TYPE = "application/x-launchops-entry";

type View = "month" | "week";

interface DragPayload {
  kind: "event" | "launch";
  id: string;
  from: string;
}

interface DayEntry {
  key: string;
  title: string;
  color: string;
  drag: DragPayload;
  launch?: boolean;
  event?: CalendarEvent;
  project?: Project;
}

const isEntryDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes(DRAG_TYPE);

function readPayload(e: DragEvent): DragPayload | null {
  try {
    const value = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as Partial<DragPayload>;
    return (value.kind === "event" || value.kind === "launch") && typeof value.id === "string" && typeof value.from === "string"
      ? (value as DragPayload)
      : null;
  } catch {
    return null;
  }
}

const dayLabel = (date: string, count: number) =>
  `${formatDateKey(date, "long")}${count ? `, ${count} entr${count === 1 ? "y" : "ies"}` : ""}`;

export function CalendarPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "week" ? "week" : "month";
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [projectFilter, setProjectFilter] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [changingLaunch, setChangingLaunch] = useState<Project | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const calendar = useCalendar();
  const projects = useProjects();
  const remove = useUndoableDelete();
  const updateEvent = useUpdateEvent();
  const setLaunchDate = useSetLaunchDate();
  const toast = useToast();
  // Adding, editing, deleting and moving entries, and moving launch dates, need the Editor role.
  const canEdit = useOrganisation().can("editor");

  const anchorDate = parseDateKey(anchor)!;
  const week = weekDays(anchor);
  const label = view === "month" ? formatMonth(anchor) : formatWeekRange(week);
  const unit = view === "month" ? "month" : "week";

  const projectById = new Map((projects.data ?? []).map((p) => [p.id, p]));
  const entriesFor = (date: string): DayEntry[] => {
    const launches = (projects.data ?? [])
      .filter((p) => p.launch_date === date && (!projectFilter || p.id === projectFilter))
      .map((p) => ({
        key: `launch-${p.id}`,
        title: p.name,
        color: swatchColor(p.color),
        launch: true,
        project: p,
        drag: { kind: "launch" as const, id: p.id, from: date },
      }));
    const events = (calendar.data ?? [])
      .filter((e) => e.date === date && (!projectFilter || e.product_id === projectFilter))
      .map((e) => ({
        key: e.id,
        title: e.title,
        color: swatchColor(projectById.get(e.product_id)?.color ?? e.color),
        event: e,
        project: projectById.get(e.product_id),
        drag: { kind: "event" as const, id: e.id, from: date },
      }));
    return [...launches, ...events];
  };

  const setView = (next: View) => {
    setAnchor(selected);
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === "week") updated.set("view", "week");
        else updated.delete("view");
        return updated;
      },
      { replace: true },
    );
  };

  const shift = (delta: number) => {
    if (view === "month") {
      setAnchor(monthStart(anchor, delta));
    } else {
      setAnchor(addDays(anchor, 7 * delta));
      setSelected(addDays(selected, 7 * delta));
    }
  };

  const move = (payload: DragPayload, to: string) => {
    if (payload.from === to) return;
    if (payload.kind === "event") {
      const event = calendar.data?.find((e) => e.id === payload.id);
      if (!event) return;
      const undo = () =>
        updateEvent.mutate(
          { id: event.id, patch: { date: payload.from } },
          { onError: (err) => toast.show({ title: "Move not undone", description: errorMessage(err), tone: "crit" }) },
        );
      const toastId = toast.show({
        title: "Entry moved",
        description: `${event.title} · ${formatDateKey(to, "weekday")}`,
        tone: "info",
        duration: UNDO_WINDOW_MS,
        action: { label: "Undo", onClick: undo },
      });
      updateEvent.mutate(
        { id: event.id, patch: { date: to } },
        {
          onError: (err) => {
            toast.dismiss(toastId);
            toast.show({ title: "Entry not moved", description: errorMessage(err), tone: "crit" });
          },
        },
      );
    } else {
      const project = projects.data?.find((p) => p.id === payload.id);
      if (!project) return;
      const undo = () =>
        setLaunchDate.mutate(
          { id: project.id, launchDate: payload.from },
          { onError: (err) => toast.show({ title: "Move not undone", description: errorMessage(err), tone: "crit" }) },
        );
      const toastId = toast.show({
        title: `${project.name} launch moved`,
        description: formatDateKey(to, "long"),
        tone: "info",
        duration: UNDO_WINDOW_MS,
        action: { label: "Undo", onClick: undo },
      });
      setLaunchDate.mutate(
        { id: project.id, launchDate: to },
        {
          onError: (err) => {
            toast.dismiss(toastId);
            toast.show({ title: "Launch date not changed", description: errorMessage(err), tone: "crit" });
          },
        },
      );
    }
  };

  /** Handlers that make a day (month cell or week column) accept dropped entries, for people who can move them. */
  const dropZone = (date: string) => {
    if (!canEdit) return {};
    return {
      onDragEnter: (e: DragEvent<HTMLDivElement>) => {
        if (!isEntryDrag(e)) return;
        e.preventDefault();
        setDropTarget(date);
      },
      onDragOver: (e: DragEvent<HTMLDivElement>) => {
        if (!isEntryDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(date);
      },
      onDragLeave: (e: DragEvent<HTMLDivElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDropTarget((current) => (current === date ? null : current));
      },
      onDrop: (e: DragEvent<HTMLDivElement>) => {
        if (!isEntryDrag(e)) return;
        e.preventDefault();
        setDropTarget(null);
        setDragging(null);
        const payload = readPayload(e);
        if (payload) move(payload, date);
      },
    };
  };

  const chip = (entry: DayEntry, date: string, detailed = false) => (
    <EntryChip
      key={entry.key}
      entry={entry}
      detailed={detailed}
      movable={canEdit}
      dragging={dragging === entry.key}
      onSelect={() => setSelected(date)}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(entry.drag));
        e.dataTransfer.setData("text/plain", entry.title);
        e.dataTransfer.effectAllowed = "move";
        setDragging(entry.key);
      }}
      onDragEnd={() => {
        setDragging(null);
        setDropTarget(null);
      }}
    />
  );

  const selectedEntries = entriesFor(selected);

  return (
    <>
      <PageHeader
        title="Calendar"
        lede={
          <>
            Launch dates and planned content across every project.
            {canEdit && <span className={styles.dragHint}> Drag an entry to another day to reschedule it.</span>}
          </>
        }
        actions={
          canEdit && (
            <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setAdding(selected)} disabled={!projects.data?.length}>
              Add entry
            </Button>
          )
        }
      />
      <div className={styles.toolbar}>
        <div className={styles.group}>
          <IconButton label={`Previous ${unit}`} variant="secondary" onClick={() => shift(-1)}>
            <ChevronLeft aria-hidden="true" />
          </IconButton>
          <IconButton label={`Next ${unit}`} variant="secondary" onClick={() => shift(1)}>
            <ChevronRight aria-hidden="true" />
          </IconButton>
          <h2 className={styles.period} aria-live="polite">
            {label}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAnchor(today);
              setSelected(today);
            }}
          >
            Today
          </Button>
        </div>
        <div className={styles.group}>
          <Segmented
            label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
            ]}
          />
          <Select aria-label="Filter by project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ width: 220 }}>
            <option value="">All projects</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className={styles.layout}>
        {view === "month" ? (
          <div className={styles.grid} role="group" aria-label={label}>
            {WEEKDAYS.map((d) => (
              <div key={d} className={cx(styles.weekday, "placard")} aria-hidden="true">
                {d}
              </div>
            ))}
            {monthGrid(anchorDate.getFullYear(), anchorDate.getMonth()).map((date) => {
              const d = parseDateKey(date)!;
              const entries = entriesFor(date);
              return (
                <div
                  key={date}
                  className={cx(
                    styles.day,
                    d.getMonth() !== anchorDate.getMonth() && styles.outside,
                    date === today && styles.today,
                    entries.length > 0 && styles.hasEntries,
                    dropTarget === date && styles.dropTarget,
                  )}
                  {...dropZone(date)}
                >
                  <button
                    type="button"
                    className={styles.dayButton}
                    aria-pressed={date === selected}
                    aria-label={dayLabel(date, entries.length)}
                    onClick={() => setSelected(date)}
                    onDoubleClick={canEdit ? () => setAdding(date) : undefined}
                  >
                    <span className={styles.dayNumber}>{d.getDate()}</span>
                  </button>
                  {entries.slice(0, 3).map((entry) => chip(entry, date))}
                  {entries.length > 3 && (
                    <span className={styles.more} aria-hidden="true">
                      +{entries.length - 3} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.week} role="group" aria-label={label}>
            {week.map((date, index) => {
              const entries = entriesFor(date);
              return (
                <div
                  key={date}
                  className={cx(styles.weekDay, date === today && styles.today, dropTarget === date && styles.dropTarget)}
                  {...dropZone(date)}
                >
                  <button
                    type="button"
                    className={styles.weekHeader}
                    aria-pressed={date === selected}
                    aria-label={dayLabel(date, entries.length)}
                    onClick={() => setSelected(date)}
                    onDoubleClick={canEdit ? () => setAdding(date) : undefined}
                  >
                    <span className="placard">{WEEKDAYS[index]}</span>
                    <span className={styles.dayNumber}>{parseDateKey(date)!.getDate()}</span>
                  </button>
                  <div className={styles.weekEntries}>{entries.map((entry) => chip(entry, date, true))}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.agenda}>
          <Panel
            title={formatDateKey(selected, "long")}
            flush
            actions={
              canEdit && (
                <Button size="sm" variant="ghost" icon={<Plus aria-hidden="true" />} onClick={() => setAdding(selected)} disabled={!projects.data?.length}>
                  Add
                </Button>
              )
            }
          >
            {selectedEntries.length === 0 ? (
              <EmptyState title="Nothing on this day">
                {canEdit ? (
                  "Select Add to plan content for this date. Double-click any day to add quickly."
                ) : (
                  <RoleRequirement action="Adding entries" minimum="editor" />
                )}
              </EmptyState>
            ) : (
              <ul className={styles.agendaList}>
                {selectedEntries.map((entry) => (
                  <li key={entry.key} className={styles.agendaItem}>
                    {entry.launch ? (
                      <Rocket size={14} aria-hidden="true" style={{ marginTop: 2 }} />
                    ) : (
                      <span className={styles.dot} style={{ background: entry.color, marginTop: 6 }} />
                    )}
                    <div className={styles.agendaMain}>
                      <span style={{ fontWeight: 560 }}>{entry.launch ? `${entry.title} launches` : entry.title}</span>
                      <span className={styles.agendaMeta}>
                        {entry.project ? <Link to={routes.project(entry.project.id)}>{entry.project.name}</Link> : "Project"}
                        {entry.event ? ` · ${entry.event.platform === "all" ? "All channels" : channelName(entry.event.platform)}` : " · Launch date"}
                      </span>
                    </div>
                    <div className={styles.agendaActions}>
                      {canEdit &&
                        (entry.event ? (
                          <>
                            <IconButton size="sm" label={`Edit ${entry.title}`} onClick={() => setEditing(entry.event!)}>
                              <Pencil aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              size="sm"
                              label={`Delete ${entry.title}`}
                              onClick={() => remove({ id: entry.event!.id, noun: "Entry", listKeys: [keys.calendar()], remove: calendarApi.remove })}
                            >
                              <Trash2 aria-hidden="true" />
                            </IconButton>
                          </>
                        ) : (
                          entry.project && (
                            <IconButton size="sm" label={`Change launch date for ${entry.project.name}`} onClick={() => setChangingLaunch(entry.project!)}>
                              <CalendarClock aria-hidden="true" />
                            </IconButton>
                          )
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Modal open={adding !== null} onOpenChange={(o) => !o && setAdding(null)} title="Add calendar entry" description="Plan a piece of content or a task for a project.">
        {adding !== null && <EntryForm date={adding} projects={projects.data ?? []} defaultProject={projectFilter} onDone={() => setAdding(null)} />}
      </Modal>
      <Modal open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title="Edit calendar entry" description="Change what's planned, when, or for which project.">
        {editing && <EntryForm event={editing} projects={projects.data ?? []} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal
        open={changingLaunch !== null}
        onOpenChange={(o) => !o && setChangingLaunch(null)}
        title="Change launch date"
        description="The launch date sets the countdown and launch status everywhere in LaunchOps."
      >
        {changingLaunch && <LaunchDateForm project={changingLaunch} onDone={() => setChangingLaunch(null)} />}
      </Modal>
    </>
  );
}

function EntryChip({
  entry,
  detailed,
  movable,
  dragging,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  entry: DayEntry;
  detailed: boolean;
  /** Whether the user's role lets them drag the entry to another day. */
  movable: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDragStart: (e: DragEvent<HTMLSpanElement>) => void;
  onDragEnd: () => void;
}) {
  const meta = entry.launch
    ? "Launch"
    : [entry.event?.platform === "all" ? "All channels" : channelName(entry.event?.platform ?? ""), entry.project?.name].filter(Boolean).join(" · ");
  return (
    // Pointer shortcut only: the day's button and agenda carry the same information and actions.
    <span
      aria-hidden="true"
      draggable={movable}
      title={movable ? (entry.launch ? "Drag to change the launch date" : "Drag to reschedule") : undefined}
      className={cx(styles.entry, entry.launch && styles.launchEntry, detailed && styles.detailed, dragging && styles.dragging)}
      onClick={onSelect}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={movable ? onDragEnd : undefined}
    >
      <span className={styles.entryTitle}>
        {entry.launch ? <Rocket size={10} aria-hidden="true" style={{ flexShrink: 0 }} /> : <span className={styles.dot} style={{ background: entry.color }} />}
        <span className={styles.entryText}>{entry.title}</span>
      </span>
      {detailed && <span className={styles.entryMeta}>{meta}</span>}
    </span>
  );
}

function EntryForm({
  date,
  event,
  projects,
  defaultProject,
  onDone,
}: {
  date?: string;
  event?: CalendarEvent;
  projects: Project[];
  defaultProject?: string;
  onDone: () => void;
}) {
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const toast = useToast();
  const [form, setForm] = useState(() =>
    event
      ? { date: event.date, title: event.title, product_id: event.product_id, platform: event.platform || "all" }
      : { date: date ?? "", title: "", product_id: defaultProject || projects[0]?.id || "", platform: "all" },
  );
  const [error, setError] = useState<string | null>(null);
  const pending = event ? update.isPending : create.isPending;

  if (!projects.length) return <Notice>Create a project first — every entry belongs to a project.</Notice>;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const data = { ...form, title: form.title.trim() };
        try {
          if (event) {
            await update.mutateAsync({ id: event.id, patch: data });
            toast.show({ title: "Entry updated", description: `${formatDateKey(data.date, "medium")} · ${data.title}` });
          } else {
            await create.mutateAsync(data);
            toast.show({ title: "Entry added", description: `${formatDateKey(data.date, "medium")} · ${data.title}` });
          }
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <FieldStack>
        <Field label="Title">
          {(p) => <Input {...p} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Launch thread on X" autoFocus required />}
        </Field>
        <FieldRow>
          <Field label="Date">{(p) => <Input {...p} type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />}</Field>
          <Field label="Project">
            {(p) => (
              <Select {...p} value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FieldRow>
        <Field label="Channel">
          {(p) => (
            <Select {...p} value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
              <option value="all">All channels</option>
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {error && <Notice tone="crit">{error}</Notice>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending} disabled={!form.title.trim() || !form.date}>
            {event ? "Save changes" : "Add entry"}
          </Button>
        </div>
      </FieldStack>
    </form>
  );
}

function LaunchDateForm({ project, onDone }: { project: Project; onDone: () => void }) {
  const setLaunchDate = useSetLaunchDate();
  const toast = useToast();
  const [value, setValue] = useState(project.launch_date ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await setLaunchDate.mutateAsync({ id: project.id, launchDate: value || null });
          toast.show({ title: "Launch date saved", description: `${project.name} · ${value ? formatDateKey(value, "long") : "No launch date"}` });
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <FieldStack>
        <Field label="Launch date" hint={`For ${project.name}. Clear it to remove the launch from the calendar.`}>
          {(p) => <Input {...p} type="date" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />}
        </Field>
        {error && <Notice tone="crit">{error}</Notice>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={setLaunchDate.isPending} disabled={value === (project.launch_date ?? "")}>
            Save date
          </Button>
        </div>
      </FieldStack>
    </form>
  );
}
