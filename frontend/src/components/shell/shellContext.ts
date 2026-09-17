import { createContext, useContext } from "react";

export interface ShellDialogs {
  openNewProject: () => void;
  openCapture: (projectId?: string) => void;
  openPalette: () => void;
}

export const ShellContext = createContext<ShellDialogs | null>(null);

export function useShell(): ShellDialogs {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside AppShell");
  return ctx;
}
