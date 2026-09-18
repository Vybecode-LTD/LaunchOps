import { useState } from "react";
import { Link } from "react-router";
import { Collapsible } from "radix-ui";
import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import type { Project } from "@/lib/api/types";
import { useOrganisation } from "@/lib/auth/organisation";
import { useToday } from "@/lib/hooks/useClock";
import { getOperation, type OperationDef } from "@/lib/domain/operations";
import {
  ALWAYS_AVAILABLE,
  playbook,
  type Playbook as PlaybookData,
  type ResultRecord,
  type StageProgress,
  type StageStatus,
} from "@/lib/domain/playbook";
import { daysToLaunch, describeDays, tMinus } from "@/lib/domain/projects";
import { routes } from "@/lib/routes";
import { Button, cx } from "@/components/ui/Button";
import { Meter, Notice, Spinner } from "@/components/ui/Display";
import { Pill, type Tone } from "@/components/ui/Pill";
import { OperationCard } from "./OperationCard";
import pageStyles from "@/pages/project/ProjectPages.module.css";
import styles from "./Playbook.module.css";

const STAGE_PILL: Record<StageStatus, { label: string; tone: Tone }> = {
  complete: { label: "Done", tone: "ok" },
  current: { label: "Now", tone: "signal" },
  behind: { label: "Behind", tone: "warn" },
  upcoming: { label: "Later", tone: "outline" },
};

/** "A", "A and B", "A, B and C". */
function listOf(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** How far off the launch is, to end a sentence: "launch is 11 days away", "the launch date was 3 days ago". */
function launchDistance(days: number): string {
  if (days > 1) return `launch is ${days} days away`;
  if (days === 1) return "launch is tomorrow";
  if (days === 0) return "launch is today";
  return days === -1 ? "the launch date was yesterday" : `the launch date was ${-days} days ago`;
}

/**
 * The Operations screen as a guided launch: what to run next, then every stage in the order a
 * launch actually runs in. It answers "what should I do now?" rather than listing eighteen
 * operations at equal weight. Everything is still reachable — the stages hold every operation
 * except the one tool, which sits in "Always available" — and the playbook advises, it never
 * blocks: an operation from a later stage runs as normal.
 */
export function Playbook({
  project,
  queue,
  queueFailed = false,
  onRun,
}: {
  project: Project;
  /** Where the project's results stand — every one of them, as `GET /api/queue/summary` counts them — or undefined while they load. */
  queue: ResultRecord[] | undefined;
  /** The results couldn't be loaded. */
  queueFailed?: boolean;
  onRun: (id: string) => void;
}) {
  const today = useToday();
  // Until the results arrive, recommending anything would be a guess, and often a wrong one: an
  // empty queue makes finished operations look undone. Say it's working rather than guess.
  if (queue === undefined && !queueFailed) {
    return (
      <div className={styles.loading} role="status">
        <Spinner /> Working out what&apos;s next…
      </div>
    );
  }
  const book = playbook(project, queue ?? [], today);
  const days = daysToLaunch(project, today);
  const tools = ALWAYS_AVAILABLE.map((id) => getOperation(id)).filter((op): op is OperationDef => Boolean(op));

  return (
    <div className={styles.playbook}>
      {queueFailed && (
        <Notice tone="warn">
          Results couldn&apos;t be loaded, so the playbook may not show everything that&apos;s already done. Reports saved to the
          project still count.
        </Notice>
      )}
      <NextUp book={book} days={days} project={project} onRun={onRun} />

      <section className={styles.stagesSection} aria-labelledby="playbook-stages-title">
        <div className={styles.stagesHead}>
          <h2 className={styles.sectionTitle} id="playbook-stages-title">
            Launch playbook
          </h2>
          <div className={styles.progressMeter}>
            {/* "8 of 17", like each stage's own count; the meter's default would print a bare percentage. */}
            <Meter
              value={book.total ? (book.done / book.total) * 100 : 0}
              label="Playbook progress"
              valueText={`${book.done} of ${book.total} steps done`}
              display={`${book.done} of ${book.total}`}
            />
          </div>
        </div>
        <ol className={styles.stages}>
          {book.stages.map((entry, index) => (
            <Stage
              key={entry.stage.id}
              entry={entry}
              number={index + 1}
              isCurrent={book.current?.stage.id === entry.stage.id}
              project={project}
              onRun={onRun}
            />
          ))}
        </ol>
      </section>

      {tools.length > 0 && (
        <section aria-labelledby="playbook-tools-title">
          <h2 className={styles.sectionTitle} id="playbook-tools-title">
            Always available
          </h2>
          <p className={styles.sectionLead}>
            Use these at any stage. They don&apos;t count towards the playbook, because what they return isn&apos;t saved.
          </p>
          <ul className={pageStyles.opList}>
            {tools.map((op) => (
              <OperationCard key={op.id} op={op} project={project} onRun={onRun} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The single most useful thing to do next, with the reason it is next. */
function NextUp({
  book,
  days,
  project,
  onRun,
}: {
  book: PlaybookData;
  days: number | null;
  project: Project;
  onRun: (id: string) => void;
}) {
  const canRun = useOrganisation().can("editor");
  const { current, recommended } = book;
  const number = current ? book.stages.findIndex((entry) => entry.stage.id === current.stage.id) + 1 : 0;

  if (!current) {
    return (
      <section className={cx(styles.nextUp, styles.nextUpDone)} aria-label="Next up">
        <span className={styles.nextUpIcon} aria-hidden="true">
          <Check />
        </span>
        <div className={styles.nextUpBody}>
          <h2 className={styles.nextUpTitle} id="next-up-title">
            Every step of the playbook is done
          </h2>
          <p className={styles.nextUpText}>
            All {book.total} steps have a result. Run any of them again when something changes, or use the tools below.
          </p>
        </div>
      </section>
    );
  }

  const behind = current.status === "behind";
  const window = current.stage.startsAtDaysBefore;

  return (
    <section className={cx(styles.nextUp, behind && styles.nextUpBehind)} aria-label="Next up">
      <div className={styles.nextUpBody}>
        <span className="placard">
          Next up · Stage {number} of {book.stages.length} · {current.stage.title}
        </span>
        {recommended ? (
          <>
            <h2 className={styles.nextUpTitle} id="next-up-title">
              {recommended.operation.name}
            </h2>
            <p className={styles.nextUpText}>{recommended.operation.produces}</p>
          </>
        ) : (
          <>
            <h2 className={styles.nextUpTitle} id="next-up-title">
              Waiting on {current.stage.title.toLowerCase()}
            </h2>
            <p className={styles.nextUpText}>
              Everything in this stage is running or waiting for review. <Link to={routes.projectReview(project.id)}>Open Review</Link> to
              approve the results and move on.
            </p>
          </>
        )}
        {behind && window !== null && days !== null ? (
          <p className={styles.nextUpTiming}>
            <TriangleAlert aria-hidden="true" />
            Behind: this stage is normally underway {window} days before launch, and {launchDistance(days)}.
          </p>
        ) : (
          days !== null && <p className={styles.nextUpMeta}>{describeDays(days)}.</p>
        )}
        {current.missingGroundwork.length > 0 && (
          <p className={styles.nextUpMeta}>
            Builds on {listOf(current.missingGroundwork)}, which isn&apos;t finished yet — you can still run it now.
          </p>
        )}
      </div>
      {recommended && canRun && (
        <div className={styles.nextUpAction}>
          <Button variant="primary" onClick={() => onRun(recommended.operation.id)}>
            Run {recommended.operation.name.toLowerCase()}
          </Button>
        </div>
      )}
    </section>
  );
}

/** One stage: open when it's the one to work on, a one-line summary otherwise. */
function Stage({
  entry,
  number,
  isCurrent,
  project,
  onRun,
}: {
  entry: StageProgress;
  number: number;
  isCurrent: boolean;
  project: Project;
  onRun: (id: string) => void;
}) {
  const { stage, status, done, total, operations, missingGroundwork } = entry;
  const pill = STAGE_PILL[status];
  const titleId = `stage-${stage.id}-title`;
  // Open while it's the stage to work on — including when it becomes that while the screen is open,
  // which `defaultOpen` alone would miss: Radix reads it only when a stage first renders. A stage that
  // stops being current stays as it is; closing it would pull its operations, and the focus on them,
  // out from under someone using them.
  const [open, setOpen] = useState(isCurrent);
  const [wasCurrent, setWasCurrent] = useState(isCurrent);
  if (isCurrent !== wasCurrent) {
    setWasCurrent(isCurrent);
    if (isCurrent) setOpen(true);
  }

  return (
    <li className={cx(styles.stage, styles[status])}>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <h3 className={styles.stageHeading} id={titleId}>
          <Collapsible.Trigger className={styles.stageTrigger}>
            <span className={styles.marker} aria-hidden="true">
              {status === "complete" ? <Check /> : number}
            </span>
            <span className={styles.stageName}>
              <span className={styles.stageNumber}>Stage {number}</span>
              <span className={styles.stageTitle}>{stage.title}</span>
            </span>
            <span className={styles.stageMeta}>
              {stage.startsAtDaysBefore !== null && <span className={styles.stageWindow}>From {tMinus(stage.startsAtDaysBefore)}</span>}
              <span className={styles.stageCount}>
                <span className="num">{done}</span> of <span className="num">{total}</span>
              </span>
              <Pill tone={pill.tone}>{pill.label}</Pill>
            </span>
            <ChevronDown className={styles.chevron} aria-hidden="true" />
          </Collapsible.Trigger>
        </h3>
        <Collapsible.Content className={styles.stageBody}>
          <p className={styles.purpose}>{stage.purpose}</p>
          {missingGroundwork.length > 0 && status !== "complete" && (
            <p className={styles.groundwork}>
              Builds on {listOf(missingGroundwork)}, which isn&apos;t finished yet. You can still run these now.
            </p>
          )}
          <ul className={pageStyles.opList} aria-labelledby={titleId}>
            {operations.map(({ operation, state }) => (
              <OperationCard key={operation.id} op={operation} project={project} onRun={onRun} state={state} />
            ))}
          </ul>
        </Collapsible.Content>
      </Collapsible.Root>
    </li>
  );
}
