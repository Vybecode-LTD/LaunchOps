import type { Checklist } from "@/lib/api/types";

/**
 * The launch plan. Phase names and item order are part of the stored data
 * format — checked state is saved under `${phase}_${index}` and custom items
 * under `_custom_${phase}` — so they must not be renamed or reordered.
 */

export interface PhaseDef {
  phase: "Pre-Launch" | "Launch Day" | "Post-Launch";
  label: string;
  items: string[];
}

export const PLAN_PHASES: PhaseDef[] = [
  {
    phase: "Pre-Launch",
    label: "Pre-launch",
    items: [
      "Brand assets finalized (logo, colors, screenshots)",
      "Press kit created & reviewed",
      "Landing page / product page live",
      "Social media profiles set up",
      "Email list / waitlist ready",
      "Beta testers recruited",
      "Content calendar planned (2 weeks)",
      "Press & influencer outreach list built",
      "Reddit communities identified",
      "SEO keywords researched",
      "Product URL live & accessible",
      "SSL certificate valid",
      "Payment / signup flow tested",
      "Download links verified",
      "Analytics & UTM tracking installed",
    ],
  },
  {
    phase: "Launch Day",
    label: "Launch day",
    items: [
      "8:00 — Final pre-flight checks",
      "9:00 — Product Hunt listing live",
      "9:15 — Twitter/X launch thread posted",
      "9:30 — LinkedIn announcement",
      "9:45 — Reddit posts to target communities",
      "10:00 — Email blast sent",
      "10:30 — Instagram post + stories",
      "11:00 — Submit to free directories",
      "12:00 — Engage with early comments",
      "2:00 — Share social proof / reactions",
      "5:00 — End-of-day check-in post",
    ],
  },
  {
    phase: "Post-Launch",
    label: "Post-launch",
    items: [
      "Press follow-up emails (day 3)",
      "Collect & respond to user feedback",
      "Engage with social mentions & comments",
      "Review analytics & adjust strategy",
      "Week 2 content published",
      "Gather testimonials & reviews",
      "Launch retrospective — what worked?",
    ],
  },
];

export interface PlanItem {
  key: string;
  label: string;
  /** Launch-day time slot, e.g. "9:15", when the item has one. */
  time?: string;
  checked: boolean;
  custom: boolean;
  customIndex?: number;
}

const TIME_PREFIX = /^(\d{1,2}):(\d{2})\s+—\s+(.*)$/;

/**
 * The built-in launch-day schedule runs 8:00 to 5:00 and writes afternoon times
 * without am/pm ("2:00"). Show them on a 24-hour clock so "2:00" can't be misread.
 */
export function launchDayClock(hours: number, minutes: string): string {
  const h = hours < 8 ? hours + 12 : hours;
  return `${String(h).padStart(2, "0")}:${minutes}`;
}

export function customItems(checklist: Checklist, phase: string): string[] {
  const raw = checklist[`_custom_${phase}`];
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

export function phaseItems(checklist: Checklist, def: PhaseDef): PlanItem[] {
  const base = def.items.map((label, i): PlanItem => {
    const key = `${def.phase}_${i}`;
    const match = TIME_PREFIX.exec(label);
    return {
      key,
      label: match ? (match[3] ?? label) : label,
      time: match ? launchDayClock(Number(match[1]), match[2]!) : undefined,
      checked: checklist[key] === true,
      custom: false,
    };
  });
  const custom = customItems(checklist, def.phase).map((label, ci): PlanItem => {
    const key = `${def.phase}_${def.items.length + ci}`;
    return { key, label, checked: checklist[key] === true, custom: true, customIndex: ci };
  });
  return [...base, ...custom];
}

export function planProgress(checklist: Checklist): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const def of PLAN_PHASES) {
    for (const item of phaseItems(checklist, def)) {
      total += 1;
      if (item.checked) done += 1;
    }
  }
  return { done, total };
}

export function setChecked(checklist: Checklist, key: string, checked: boolean): Checklist {
  return { ...checklist, [key]: checked };
}

export function addCustomItem(checklist: Checklist, phase: string, label: string): Checklist {
  const trimmed = label.trim();
  if (!trimmed) return checklist;
  return { ...checklist, [`_custom_${phase}`]: [...customItems(checklist, phase), trimmed] };
}

/**
 * Remove a custom item and shift the checked state of the items after it, so
 * every remaining item keeps its own tick.
 */
export function removeCustomItem(checklist: Checklist, def: PhaseDef, customIndex: number): Checklist {
  const custom = customItems(checklist, def.phase);
  if (customIndex < 0 || customIndex >= custom.length) return checklist;
  const next: Checklist = { ...checklist, [`_custom_${def.phase}`]: custom.filter((_, i) => i !== customIndex) };
  const base = def.items.length;
  for (let i = customIndex; i < custom.length - 1; i += 1) {
    const from = `${def.phase}_${base + i + 1}`;
    const to = `${def.phase}_${base + i}`;
    if (checklist[from] === true) next[to] = true;
    else delete next[to];
  }
  delete next[`${def.phase}_${base + custom.length - 1}`];
  return next;
}
