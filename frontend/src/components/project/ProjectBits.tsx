import { Check, Circle } from "lucide-react";
import type { Project } from "@/lib/api/types";
import {
  LAUNCH_STATE_LABELS,
  LAUNCH_STATE_RULES,
  READINESS_WEIGHTS,
  describeDays,
  hasReport,
  REPORT_KEYS,
  swatchColor,
  tMinus,
  type LaunchState,
  type Readiness,
} from "@/lib/domain/projects";
import { reportForKey } from "@/lib/domain/operations";
import { formatDateKey } from "@/lib/domain/dates";
import { cx } from "@/components/ui/Button";
import { Meter } from "@/components/ui/Display";
import { Pill, type Tone } from "@/components/ui/Pill";
import { Popover } from "@/components/ui/Overlay";
import styles from "./Project.module.css";

export function ProjectSwatch({ color, size = "md" }: { color: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cx(styles.swatch, size === "lg" && styles.swatchLg)}
      style={{ background: swatchColor(color) }}
      aria-hidden="true"
    />
  );
}

const STATE_TONES: Record<LaunchState, Tone> = {
  launched: "ok",
  overdue: "crit",
  at_risk: "warn",
  on_track: "neutral",
  unscheduled: "outline",
};

/** The launch-state pill; selecting it explains the rule that produced the state. */
export function LaunchStatePill({ state }: { state: LaunchState }) {
  return (
    <Popover
      label={`${LAUNCH_STATE_LABELS[state]}: how it's decided`}
      trigger={
        <button type="button" className={styles.infoTrigger} aria-label={`${LAUNCH_STATE_LABELS[state]}. Show how this is decided.`}>
          <Pill tone={STATE_TONES[state]}>{LAUNCH_STATE_LABELS[state]}</Pill>
        </button>
      }
    >
      <div className={styles.popoverText}>
        <span className="placard">{LAUNCH_STATE_LABELS[state]}</span>
        <p>{LAUNCH_STATE_RULES[state]}</p>
      </div>
    </Popover>
  );
}

export function LaunchClock({
  days,
  launchDate,
  state,
  size = "md",
}: {
  days: number | null;
  launchDate?: string | null;
  state: LaunchState;
  size?: "md" | "lg";
}) {
  const tone =
    days === null ? styles.clockMuted : state === "overdue" ? styles.clockCrit : state === "at_risk" ? styles.clockWarn : undefined;
  const label = launchDate ? `${describeDays(days)}, ${formatDateKey(launchDate, "long")}` : describeDays(days);
  return (
    <span className={cx(styles.clock, tone, size === "lg" && styles.clockLg)} title={label}>
      <span aria-hidden="true">{tMinus(days)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ReportLamps({ project }: { project: Project }) {
  const lit = REPORT_KEYS.filter((key) => hasReport(project[key]));
  const summary = `${lit.length} of ${REPORT_KEYS.length} reports generated`;
  return (
    <Popover
      label="Reports generated"
      trigger={
        <button type="button" className={styles.infoTrigger} aria-label={`${summary}. Show which.`}>
          <span className={styles.lamps} aria-hidden="true">
            {REPORT_KEYS.map((key) => (
              <span key={key} className={cx(styles.lamp, hasReport(project[key]) && styles.lampLit)} />
            ))}
          </span>
        </button>
      }
    >
      <div className={styles.popoverText}>
        <span className="placard">{summary}</span>
        <ul className={styles.checkList}>
          {REPORT_KEYS.map((key) => (
            <li key={key} className={cx(styles.checkItem, hasReport(project[key]) ? styles.checkDone : styles.checkMissing)}>
              {hasReport(project[key]) ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
              {reportForKey(key)?.name}
              <span className="sr-only">{hasReport(project[key]) ? "(generated)" : "(not generated)"}</span>
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  );
}

function CheckList({ items }: { items: Array<{ id: string; label: string; done: boolean }> }) {
  return (
    <ul className={styles.checkList}>
      {items.map((item) => (
        <li key={item.id} className={cx(styles.checkItem, item.done ? styles.checkDone : styles.checkMissing)}>
          {item.done ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
          <span>{item.label}</span>
          <span className="sr-only">{item.done ? "(done)" : "(missing)"}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReadinessBreakdown({ readiness }: { readiness: Readiness }) {
  const assetsDone = readiness.assets.filter((a) => a.done).length;
  const profileDone = readiness.profile.filter((p) => p.done).length;
  return (
    <div className={styles.breakdown}>
      <div className={styles.breakdownHead}>
        <span className="placard">Launch readiness</span>
        <span className={styles.breakdownScore}>{readiness.score}</span>
      </div>
      <div className={styles.breakdownSection}>
        <div className={styles.breakdownRow}>
          <span>
            Launch plan · {readiness.plan.done}/{readiness.plan.total} items
          </span>
          <span className={styles.breakdownWeight}>{READINESS_WEIGHTS.plan} pts</span>
        </div>
      </div>
      <div className={styles.breakdownSection}>
        <div className={styles.breakdownRow}>
          <span>Reports · {assetsDone}/5 generated</span>
          <span className={styles.breakdownWeight}>{READINESS_WEIGHTS.assets} pts</span>
        </div>
        <CheckList items={readiness.assets} />
      </div>
      <div className={styles.breakdownSection}>
        <div className={styles.breakdownRow}>
          <span>Profile · {profileDone}/5 complete</span>
          <span className={styles.breakdownWeight}>{READINESS_WEIGHTS.profile} pts</span>
        </div>
        <CheckList items={readiness.profile} />
      </div>
      <p className={styles.formula}>
        Score = {READINESS_WEIGHTS.plan} × plan items done ÷ total + {READINESS_WEIGHTS.assets} × reports ÷ 5 +{" "}
        {READINESS_WEIGHTS.profile} × profile checks ÷ 5, rounded.
      </p>
    </div>
  );
}

export function ReadinessMeter({ readiness, size = "md" }: { readiness: Readiness; size?: "md" | "lg" }) {
  return (
    <Popover
      label="Launch readiness breakdown"
      trigger={
        <button type="button" className={styles.readinessTrigger} aria-label={`Launch readiness ${readiness.score} of 100. Show breakdown.`}>
          <Meter value={readiness.score} label="Launch readiness" size={size} />
        </button>
      }
    >
      <ReadinessBreakdown readiness={readiness} />
    </Popover>
  );
}

