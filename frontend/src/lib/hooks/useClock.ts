import { useEffect, useState } from "react";
import { toDateKey } from "@/lib/domain/dates";

/** Current time in ms, refreshed on an interval (for relative times and stall detection). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Today's local calendar date as YYYY-MM-DD; rolls over at midnight. */
export function useToday(): string {
  const now = useNow(60_000);
  return toDateKey(new Date(now));
}
