import { useEffect, useRef, useState } from "react";
import { niceTicks, type ScenarioSeries } from "@/lib/domain/chart";
import { formatMoney } from "@/lib/domain/values";
import styles from "./Results.module.css";

const YEARS = ["Year 1", "Year 2", "Year 3"] as const;
const SERIES_COLORS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)"];

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface Hover {
  series: number;
  year: number;
  x: number;
  y: number;
}

/** Grouped columns: three projection years, one column per scenario. */
export function RevenueChart({ series }: { series: ScenarioSeries[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<Hover | null>(null);

  const height = 260;
  const margin = { top: 28, right: 12, bottom: 30, left: 60 };
  const plotW = Math.max(200, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const max = Math.max(...series.flatMap((s) => s.values));
  // Direct-label only the single largest value; columns are narrower than their labels,
  // so labelling every cap collides. The axis, tooltip and table carry the rest.
  const peakSeries = series.findIndex((s) => s.values.includes(max));
  const peak = { series: peakSeries, year: peakSeries >= 0 ? series[peakSeries]!.values.indexOf(max) : -1 };
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] ?? 1;
  const y = (v: number) => margin.top + plotH - (v / top) * plotH;
  const band = plotW / YEARS.length;
  const gap = 2;
  const barW = Math.min(24, (band * 0.6 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);

  const barX = (yearIndex: number, seriesIndex: number) => margin.left + band * yearIndex + (band - groupW) / 2 + seriesIndex * (barW + gap);

  return (
    <figure style={{ margin: 0 }}>
      <div className={styles.legend} aria-hidden="true" style={{ marginBottom: 8 }}>
        {series.map((s, i) => (
          <span key={s.key} className={styles.legendItem}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: SERIES_COLORS[i] }} />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
        <svg
          className={styles.chart}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Revenue projections by scenario. ${series
            .map((s) => `${s.label}: ${s.values.map((v, i) => `${YEARS[i]} ${formatMoney(v)}`).join(", ")}`)
            .join(". ")}.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className={styles.chartGrid} x1={margin.left} x2={margin.left + plotW} y1={y(t)} y2={y(t)} />
              <text className={styles.chartAxis} x={margin.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {formatMoney(t)}
              </text>
            </g>
          ))}
          {YEARS.map((label, yi) => (
            <text key={label} className={styles.chartAxis} x={margin.left + band * yi + band / 2} y={height - 8} textAnchor="middle">
              {label}
            </text>
          ))}
          {series.map((s, si) =>
            s.values.map((v, yi) => {
              const x = barX(yi, si);
              const barTop = y(v);
              const h = Math.max(0, margin.top + plotH - barTop);
              const r = Math.min(4, h, barW / 2);
              const path = `M${x},${margin.top + plotH} V${barTop + r} Q${x},${barTop} ${x + r},${barTop} H${x + barW - r} Q${x + barW},${barTop} ${x + barW},${barTop + r} V${margin.top + plotH} Z`;
              const active = hover?.series === si && hover?.year === yi;
              return (
                <g key={`${s.key}-${yi}`}>
                  <path d={path} fill={SERIES_COLORS[si]} opacity={hover && !active ? 0.55 : 1} />
                  {si === peak.series && yi === peak.year && (
                    <text className={styles.chartLabel} x={x + barW / 2} y={barTop - 6} textAnchor="middle" fill="var(--ink)">
                      {formatMoney(v)}
                    </text>
                  )}
                  <rect
                    x={x - gap / 2}
                    y={margin.top}
                    width={barW + gap}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${s.label}, ${YEARS[yi]}: ${formatMoney(v)}`}
                    onPointerEnter={() => setHover({ series: si, year: yi, x: x + barW / 2, y: barTop })}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover({ series: si, year: yi, x: x + barW / 2, y: barTop })}
                    onBlur={() => setHover(null)}
                    style={{ outline: "none", cursor: "default" }}
                  />
                </g>
              );
            }),
          )}
          <line className={styles.chartGrid} x1={margin.left} x2={margin.left + plotW} y1={margin.top + plotH} y2={margin.top + plotH} style={{ stroke: "var(--line-strong)" }} />
        </svg>
        {hover && (
          <div
            role="status"
            style={{
              position: "absolute",
              left: Math.min(Math.max(hover.x, 70), width - 70),
              top: Math.max(hover.y - 12, 0),
              transform: "translate(-50%, -100%)",
              padding: "6px 10px",
              borderRadius: 6,
              background: "var(--surface-overlay)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-overlay)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              fontSize: "var(--text-12)",
            }}
          >
            <div className="num" style={{ fontSize: "var(--text-14)", fontWeight: 600, color: "var(--ink)" }}>
              {formatMoney(series[hover.series]!.values[hover.year]!)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}>
              <span style={{ width: 12, height: 2, borderRadius: 1, background: SERIES_COLORS[hover.series] }} />
              {series[hover.series]!.label} · {YEARS[hover.year]}
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
