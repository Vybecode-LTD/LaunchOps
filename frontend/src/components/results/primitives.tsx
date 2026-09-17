import type { ReactNode } from "react";
import { ExternalLink as ExternalIcon } from "lucide-react";
import { resultSources } from "@/lib/domain/sources";
import { hostname, safeUrl, numberFrom } from "@/lib/domain/values";
import { cx } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/Display";
import styles from "./Results.module.css";

export function Section({
  id,
  title,
  count,
  copy,
  actions,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  copy?: string | (() => string);
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle} id={id ? `${id}-title` : undefined}>
          {title}
          {count !== undefined && <span className={styles.sectionCount}>{count}</span>}
        </h2>
        <div style={{ display: "flex", gap: 4 }} data-print="hide">
          {actions}
          {copy && <CopyButton value={copy} label="Copy section" />}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: string }) {
  return <p className={styles.prose}>{children}</p>;
}

export function ExternalLink({ href, children }: { href: unknown; children?: ReactNode }) {
  const url = safeUrl(href);
  if (!url) return children ? <span>{children}</span> : null;
  return (
    <a className={styles.link} href={url} target="_blank" rel="noopener noreferrer">
      {children ?? hostname(url)}
      <ExternalIcon aria-hidden="true" />
    </a>
  );
}

export function Bullets({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className={styles.bullets}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Chips({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className={styles.chips}>
      {items.map((item, i) => (
        <span key={i} className={styles.chip}>
          {item}
        </span>
      ))}
    </div>
  );
}

/** Label/value pairs; rows with empty values are skipped. */
export function KeyValues({ rows }: { rows: Array<[string, ReactNode]> }) {
  const visible = rows.filter(([, v]) => v !== "" && v !== null && v !== undefined && v !== false);
  if (!visible.length) return null;
  return (
    <dl className={styles.kv}>
      {visible.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Card({
  title,
  sub,
  aside,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx(styles.card, className)}>
      <div className={styles.cardHead}>
        <div style={{ minWidth: 0 }}>
          <h3 className={styles.cardTitle}>{title}</h3>
          {sub && <div className={styles.cardSub}>{sub}</div>}
        </div>
        {aside}
      </div>
      {children}
      {footer && <div className={styles.cardFoot}>{footer}</div>}
    </article>
  );
}

/**
 * The web pages a result's research relied on, as the search returned them, most important first: each title links
 * to its page (when the address is safe), with its site and when it was updated. Printing shows each address, which
 * a printed link can't. Nothing renders for results without sources.
 */
export function Sources({ result }: { result: unknown }) {
  const sources = resultSources(result);
  if (!sources.length) return null;
  return (
    <Section id="sources" title="Sources" count={sources.length}>
      <p className={styles.sourcesLede}>The web pages the research relied on, most important first.</p>
      <ol className={styles.sources}>
        {sources.map((source, i) => {
          const details = [source.host, source.pageAge && `Updated ${source.pageAge}`].filter(Boolean).join(" · ");
          return (
            <li key={i}>
              <div className={styles.source}>
                <ExternalLink href={source.url}>{source.title}</ExternalLink>
                {details && <span className={styles.sourceDetails}>{details}</span>}
              </div>
              {source.url && <span className={styles.sourceUrl}>{source.url}</span>}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/** 1–10 threat level as a ten-cell gauge. */
export function Threat({ value }: { value: unknown }) {
  const n = numberFrom(value);
  if (n === null) return <span className={styles.muted}>Not rated</span>;
  const level = Math.max(0, Math.min(10, Math.round(n)));
  const tone = level >= 7 ? styles.threatHigh : level >= 4 ? styles.threatMid : styles.threatOn;
  return (
    <span className={styles.threat} role="img" aria-label={`Threat level ${level} of 10`}>
      <span className={styles.threatBar} aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cx(styles.threatCell, i < level && tone)} />
        ))}
      </span>
      <span className="num">{level}/10</span>
    </span>
  );
}


