import { useOutletContext } from "react-router";
import type { Project } from "@/lib/api/types";

export interface ProjectOutletContext {
  project: Project;
}

/** The project loaded by ProjectLayout, for its child routes. */
export function useProjectContext(): Project {
  return useOutletContext<ProjectOutletContext>().project;
}
