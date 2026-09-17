import styles from "./Shell.module.css";

/** The LaunchOps mark: an ascent arc clearing the horizon, with the signal dot at apogee. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
      <rect width="32" height="32" rx="7" className={styles.markTile} />
      <path d="M8 23.5c3.2-.4 8.6-2.6 12.6-9.8" fill="none" className={styles.markArc} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="22.4" cy="10.4" r="2.6" className={styles.markDot} />
      <path d="M7 25.5h18" className={styles.markHorizon} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ companyName }: { companyName?: string }) {
  return (
    <span className={styles.wordmark}>
      <LogoMark />
      <span className={styles.wordmarkText}>
        <span className={styles.wordmarkName}>LaunchOps</span>
        {companyName && <span className={styles.wordmarkCompany}>{companyName}</span>}
      </span>
    </span>
  );
}
