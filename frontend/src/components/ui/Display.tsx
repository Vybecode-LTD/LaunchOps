import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Copy, Info, TriangleAlert, OctagonAlert } from "lucide-react";
import { Button, cx, type ButtonSize, type ButtonVariant } from "./Button";
import { copyText } from "@/lib/clipboard";
import { useToast } from "./toast";
import styles from "./Display.module.css";

export function Panel({
  title,
  actions,
  children,
  flush,
  className,
  headingLevel = 2,
  id,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  headingLevel?: 2 | 3;
  id?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={cx(styles.panel, className)} id={id} aria-label={typeof title === "string" ? title : undefined}>
      {(title || actions) && (
        <header className={styles.panelHeader}>
          {title ? <Heading className={styles.panelTitle}>{title}</Heading> : <span />}
          {actions && <div className={styles.pageActions}>{actions}</div>}
        </header>
      )}
      <div className={cx(styles.panelBody, flush && styles.panelFlush)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageTitleBlock}>
        {eyebrow && <div className="placard">{eyebrow}</div>}
        <h1 className={styles.pageTitle}>{title}</h1>
        {lede && <p className={styles.pageLede}>{lede}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  centered,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={cx(styles.empty, centered && styles.emptyCentered)}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <div className={styles.emptyTitle}>{title}</div>
      {children && <div className={styles.emptyText}>{children}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, style }: { width?: number | string; height?: number; style?: CSSProperties }) {
  return <span className={styles.skeleton} style={{ width, height, ...style }} aria-hidden="true" />;
}

export function Meter({
  value,
  label,
  size = "md",
  tone,
  valueText,
  display,
}: {
  value: number;
  label: string;
  size?: "md" | "lg";
  /** A state colour for the fill (e.g. budget use). Without one the fill is ink. Pair it with a label that says the state. */
  tone?: "ok" | "warn" | "crit";
  /** How assistive tech reads the value, when the number alone isn't enough ("82% of the $50.00 budget used"). */
  valueText?: string;
  /** What shows beside the bar; defaults to the value, rounded and clamped to 0–100. */
  display?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className={cx(styles.meter, size === "lg" && styles.meterLg, tone && styles[`meter-${tone}`])}>
      <span
        className={styles.meterTrack}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
      >
        <span className={styles.meterFill} style={{ width: `${clamped}%` }} />
        {[25, 50, 75].map((t) => (
          <span key={t} className={styles.meterTick} style={{ left: `${t}%` }} />
        ))}
      </span>
      <span className={styles.meterValue}>{display ?? clamped}</span>
    </span>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  label: string;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.segment}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

export function Spinner({ label }: { label?: string }) {
  return <span className={styles.spinner} role={label ? "status" : undefined} aria-label={label} />;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "crit" | "signal"; children: ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : tone === "crit" ? OctagonAlert : Info;
  return (
    <div
      className={cx(
        styles.notice,
        tone === "warn" && styles.noticeWarn,
        tone === "crit" && styles.noticeCrit,
        tone === "signal" && styles.noticeSignal,
      )}
      role={tone === "crit" ? "alert" : undefined}
    >
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Definitions({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className={styles.definition}>
      {items.map(([term, value], i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  size = "sm",
  variant = "ghost",
  iconOnly = false,
  toastTitle,
}: {
  value: string | (() => string);
  label?: string;
  copiedLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  iconOnly?: boolean;
  toastTitle?: string;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const onClick = async () => {
    const ok = await copyText(typeof value === "function" ? value() : value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      if (toastTitle) toast.show({ title: toastTitle });
    } else {
      toast.show({ title: "Couldn't copy", description: "Your browser blocked clipboard access.", tone: "crit" });
    }
  };
  const icon = copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />;
  return (
    <Button
      size={size}
      variant={variant}
      onClick={onClick}
      icon={icon}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      {iconOnly ? null : copied ? copiedLabel : label}
    </Button>
  );
}


