import { sortScenarioKeys } from "./order";
import { moneyFrom } from "./values";

export interface ScenarioSeries {
  key: string;
  label: string;
  values: [number, number, number];
}

/**
 * Parse the model's revenue scenarios into chartable series. Returns null when
 * the data can't be charted honestly: more than three scenarios, or any value
 * that isn't one clear, non-negative amount.
 */
export function parseScenarios(
  scenarios: Record<string, { y1?: unknown; y2?: unknown; y3?: unknown }> | undefined,
): ScenarioSeries[] | null {
  if (!scenarios) return null;
  const keys = sortScenarioKeys(Object.keys(scenarios));
  if (keys.length === 0 || keys.length > 3) return null;
  const series: ScenarioSeries[] = [];
  for (const key of keys) {
    const s = scenarios[key]!;
    const values = [moneyFrom(s.y1), moneyFrom(s.y2), moneyFrom(s.y3)];
    if (values.some((v) => v === null || v < 0)) return null;
    series.push({ key, label: key.replace(/^\w/, (c) => c.toUpperCase()), values: values as [number, number, number] });
  }
  return series;
}

function niceStep(raw: number): number {
  const exponent = Math.floor(Math.log10(raw));
  const fraction = raw / 10 ** exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

/** Clean axis ticks from 0 to a rounded maximum at or above `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const step = niceStep(max / target);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i * step <= top + step / 2; i += 1) ticks.push(Math.round(i * step * 100) / 100);
  return ticks;
}
