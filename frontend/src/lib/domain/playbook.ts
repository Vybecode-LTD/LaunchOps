import type { Project, QueueItem, ReportKey } from "@/lib/api/types";
import { getOperation, type OperationDef } from "./operations";
import { daysToLaunch, hasReport } from "./projects";

/**
 * The launch playbook: the catalogue arranged as the order a launch actually runs in.
 * Seventeen operations sit in five stages; the one tool sits outside them, in ALWAYS_AVAILABLE.
 *
 * The Operations screen lists every operation at equal weight, which answers "what can I run"
 * but not "what should I run next" — the question someone launching their first product
 * actually has. A stage groups the operations that serve one purpose, says when that purpose
 * is normally served relative to launch day, and names the stages whose output it builds on,
 * so the screen can recommend rather than enumerate.
 *
 * Stage membership is presentation, not storage: nothing here is persisted, so unlike
 * `checklist.ts` these ids and titles can be changed freely.
 */

export interface PlaybookStage {
  id: string;
  title: string;
  /** Why this stage exists, in one line, in the user's terms. */
  purpose: string;
  /** Days before launch this stage is normally underway. null means it has no window. */
  startsAtDaysBefore: number | null;
  /** Operation ids, in the order they are best run. */
  operations: string[];
  /** Stages whose output this one reads. Used to explain an out-of-order run, never to block it. */
  builtOn: string[];
}

export const PLAYBOOK: PlaybookStage[] = [
  {
    id: "understand",
    title: "Understand the market",
    purpose: "Find out who you are up against and what the market pays before you write anything.",
    startsAtDaysBefore: 45,
    operations: ["market_analysis", "competitor", "trend", "pricing"],
    builtOn: [],
  },
  {
    id: "position",
    title: "Fix the positioning",
    purpose: "Turn that research into the words everything else reuses.",
    startsAtDaysBefore: 35,
    operations: ["press_kit", "seo"],
    builtOn: ["understand"],
  },
  {
    id: "story",
    title: "Write the story",
    purpose: "The announcement itself, in the forms the press and your own channels need.",
    startsAtDaysBefore: 28,
    operations: ["press_release", "announcement", "blog"],
    builtOn: ["position"],
  },
  {
    id: "distribution",
    title: "Line up distribution",
    purpose: "Decide where the launch lands, and get on those lists before launch week.",
    startsAtDaysBefore: 21,
    operations: ["launch_platforms", "directories", "podcasts", "partnerships", "reddit"],
    builtOn: ["position"],
  },
  {
    id: "push",
    title: "Prepare the push",
    purpose: "The posts, ads and emails that go out in launch week, drafted and approved in advance.",
    startsAtDaysBefore: 14,
    operations: ["social_posts", "ad_copy", "cold_outreach"],
    builtOn: ["story"],
  },
];

/**
 * Operations that are not steps: they return their result directly and store nothing, so the
 * app cannot tell whether they have been used and must not count them towards progress or
 * recommend them. They stay available at every stage.
 */
export const ALWAYS_AVAILABLE = ["repurpose"];

/**
 * What has happened to one operation on one project.
 * `in_review` counts towards a stage being finished: the work is done, a person just has not
 * approved it yet, and holding the stage open would tell them to run it again.
 */
export type OperationState = "done" | "in_review" | "running" | "failed" | "todo";

export interface OperationProgress {
  operation: OperationDef;
  state: OperationState;
}

export type StageStatus = "complete" | "current" | "behind" | "upcoming";

export interface StageProgress {
  stage: PlaybookStage;
  operations: OperationProgress[];
  done: number;
  total: number;
  status: StageStatus;
  /** Stage titles this one builds on that are not finished. Explains, never blocks. */
  missingGroundwork: string[];
}

export interface Playbook {
  stages: StageProgress[];
  /** The stage to work on now: the first unfinished one. */
  current: StageProgress | null;
  /** The single operation to run next, if there is one. */
  recommended: { operation: OperationDef; stage: PlaybookStage } | null;
  done: number;
  total: number;
}

const COUNTS_AS_DONE: OperationState[] = ["done", "in_review"];

/** The most meaningful state among a project's runs of one operation. */
function stateFromQueue(items: QueueItem[]): OperationState {
  if (items.some((item) => item.status === "running")) return "running";
  if (items.some((item) => item.status === "approved")) return "done";
  if (items.some((item) => item.status === "pending")) return "in_review";
  if (items.some((item) => item.status === "failed")) return "failed";
  return "todo";
}

function operationState(operation: OperationDef, project: Project, queue: QueueItem[]): OperationState {
  // A report lives on the project, so a saved one is the record of the run. Without one, a
  // report falls back to the queue like any other operation — it may be running or have failed.
  if (operation.reportKey && hasReport(project[operation.reportKey as ReportKey])) return "done";
  return stateFromQueue(queue.filter((item) => item.workflow_id === operation.id));
}

/**
 * The playbook for one project: every stage, what is finished, which stage to work on now and
 * which single operation to run next.
 *
 * `today` is a local `YYYY-MM-DD` key, as everywhere else in the app — launch dates are never
 * converted through UTC.
 */
export function playbook(project: Project, queue: QueueItem[], today: string): Playbook {
  const remaining = daysToLaunch(project, today);
  const forProject = queue.filter((item) => item.product_id === project.id);

  const stages: StageProgress[] = PLAYBOOK.map((stage) => {
    const operations = stage.operations
      .map((id) => getOperation(id))
      .filter((operation): operation is OperationDef => Boolean(operation))
      .map((operation) => ({ operation, state: operationState(operation, project, forProject) }));
    const done = operations.filter((entry) => COUNTS_AS_DONE.includes(entry.state)).length;
    return {
      stage,
      operations,
      done,
      total: operations.length,
      status: "upcoming" as StageStatus,
      missingGroundwork: [],
    };
  });

  const complete = (entry: StageProgress) => entry.total > 0 && entry.done === entry.total;
  const currentIndex = stages.findIndex((entry) => !complete(entry));

  stages.forEach((entry, index) => {
    if (complete(entry)) {
      entry.status = "complete";
    } else if (index === currentIndex) {
      // Behind only when there is a launch date and its window has already opened.
      const window = entry.stage.startsAtDaysBefore;
      entry.status = remaining !== null && window !== null && remaining < window ? "behind" : "current";
    }
    entry.missingGroundwork = entry.stage.builtOn
      .map((id) => stages.find((other) => other.stage.id === id))
      .filter((other): other is StageProgress => Boolean(other) && !complete(other!))
      .map((other) => other.stage.title);
  });

  const current = currentIndex === -1 ? null : stages[currentIndex]!;
  const nextUp = current?.operations.find((entry) => entry.state === "todo" || entry.state === "failed");

  return {
    stages,
    current,
    recommended: nextUp && current ? { operation: nextUp.operation, stage: current.stage } : null,
    done: stages.reduce((total, entry) => total + entry.done, 0),
    total: stages.reduce((total, entry) => total + entry.total, 0),
  };
}
