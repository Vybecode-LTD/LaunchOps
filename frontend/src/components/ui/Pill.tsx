import type { ReactNode } from "react";
import { cx } from "./Button";
import styles from "./Pill.module.css";

export type Tone = "neutral" | "ok" | "warn" | "crit" | "signal" | "outline";

export function Pill({
  tone = "neutral",
  dot = true,
  live = false,
  children,
  title,
}: {
  tone?: Tone;
  dot?: boolean;
  live?: boolean;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={cx(styles.pill, styles[tone], live && styles.live)} title={title}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Count({ value, signal = false, label }: { value: number; signal?: boolean; label?: string }) {
  return (
    <span className={cx(styles.count, signal && styles.countSignal)} aria-label={label}>
      {value}
    </span>
  );
}
