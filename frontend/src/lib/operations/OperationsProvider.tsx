import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { errorMessage } from "@/lib/api/client";
import { operationsApi } from "@/lib/api/endpoints";
import type { Project, RepurposeResult } from "@/lib/api/types";
import { getOperation } from "@/lib/domain/operations";
import { keys } from "@/lib/queries/keys";
import { routes } from "@/lib/routes";
import { useToast } from "@/components/ui/toast";

export interface PressContacts {
  media_contact_name?: string;
  media_contact_email?: string;
  media_contact_phone?: string;
  technical_contact_name?: string;
  technical_contact_email?: string;
  sales_contact_name?: string;
  sales_contact_email?: string;
  additional_notes?: string;
}

export type ReportInput =
  | { operationId: "market_analysis"; customPricing: string }
  | { operationId: "pricing"; notes: string }
  | { operationId: "press_kit"; url: string }
  | { operationId: "press_release"; url: string; contacts: PressContacts }
  | { operationId: "seo"; url: string };

export interface RunningOperation {
  key: string;
  operationId: string;
  projectId: string;
  projectName: string;
  startedAt: number;
}

interface OperationsApi {
  running: RunningOperation[];
  isRunning: (operationId: string, projectId: string) => boolean;
  runReport: (project: Project, input: ReportInput) => Promise<void>;
  repurpose: (project: Project, content: string, platforms: string[]) => Promise<RepurposeResult>;
}

const OperationsContext = createContext<OperationsApi | null>(null);

/**
 * Report operations are single long HTTP requests. This provider lives at the
 * app root so they keep going (and announce their result) while you move
 * between pages.
 */
export function OperationsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [running, setRunning] = useState<RunningOperation[]>([]);
  const runningRef = useRef(running);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    if (!running.length) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running.length]);

  const track = useCallback(async <T,>(operationId: string, project: Project, work: () => Promise<T>): Promise<T> => {
    const key = `${operationId}:${project.id}`;
    if (runningRef.current.some((r) => r.key === key)) {
      throw new Error(`${getOperation(operationId)?.name ?? "This operation"} is already running for ${project.name}.`);
    }
    const entry: RunningOperation = {
      key,
      operationId,
      projectId: project.id,
      projectName: project.name,
      startedAt: Date.now(),
    };
    runningRef.current = [...runningRef.current, entry];
    setRunning(runningRef.current);
    try {
      return await work();
    } finally {
      runningRef.current = runningRef.current.filter((r) => r.key !== key);
      setRunning(runningRef.current);
    }
  }, []);

  const runReport = useCallback(
    async (project: Project, input: ReportInput) => {
      const op = getOperation(input.operationId);
      const name = op?.name ?? "Report";
      try {
        await track(input.operationId, project, () => {
          switch (input.operationId) {
            case "market_analysis":
              return operationsApi.marketAnalysis(project.id, input.customPricing);
            case "pricing":
              return operationsApi.pricing(project.id, input.notes);
            case "press_kit":
              return operationsApi.pressKit(project.id, input.url);
            case "press_release":
              return operationsApi.pressRelease({ product_id: project.id, url: input.url, ...input.contacts });
            case "seo":
              return operationsApi.seo(project.id, input.url);
          }
        });
        await queryClient.invalidateQueries({ queryKey: keys.project(project.id) });
        void queryClient.invalidateQueries({ queryKey: keys.projectList() });
        toast.show({
          title: `${name} saved`,
          description: project.name,
          action: op?.reportKey
            ? { label: "Open", onClick: () => navigate(routes.projectReport(project.id, op.reportKey!)) }
            : undefined,
        });
      } catch (err) {
        toast.show({ title: `${name} failed`, description: errorMessage(err), tone: "crit" });
        throw err;
      }
    },
    [navigate, queryClient, toast, track],
  );

  const repurpose = useCallback(
    (project: Project, content: string, platforms: string[]) =>
      track("repurpose", project, () => operationsApi.repurpose(project.id, content, platforms)),
    [track],
  );

  const isRunning = useCallback(
    (operationId: string, projectId: string) => running.some((r) => r.key === `${operationId}:${projectId}`),
    [running],
  );

  const api = useMemo(() => ({ running, isRunning, runReport, repurpose }), [running, isRunning, runReport, repurpose]);

  return <OperationsContext.Provider value={api}>{children}</OperationsContext.Provider>;
}

export function useOperations(): OperationsApi {
  const ctx = useContext(OperationsContext);
  if (!ctx) throw new Error("useOperations must be used inside OperationsProvider");
  return ctx;
}
