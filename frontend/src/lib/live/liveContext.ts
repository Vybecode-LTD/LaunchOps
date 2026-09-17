import { createContext, useContext } from "react";

export interface LiveUpdates {
  /**
   * Whether the live updates stream is open. While it is, lists refresh as soon as something changes, so
   * polling for running operations slows to a safety net.
   */
  connected: boolean;
}

/** Outside the signed-in shell there's no stream: `connected` is false and polling keeps its normal pace. */
export const LiveUpdatesContext = createContext<LiveUpdates>({ connected: false });

export function useLiveUpdates(): LiveUpdates {
  return useContext(LiveUpdatesContext);
}
