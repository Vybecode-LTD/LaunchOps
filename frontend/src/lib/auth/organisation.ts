import { useAuth } from "./AuthProvider";
import type { OrgRole } from "@/lib/api/types";

export const ROLE_LABELS: Record<OrgRole, string> = { viewer: "Viewer", editor: "Editor", approver: "Approver", owner: "Owner" };

/** What each role adds, in the order the roles build on each other (backend/services/access.py). */
export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  viewer: "Sees every project, result, draft and report.",
  editor: "Also creates and edits projects, runs and cancels operations, edits drafts, and manages the calendar, library and brand voice.",
  approver: "Also approves or rejects results, sends email, and deletes results and drafts.",
  owner: "Also manages members and invitations, renames the organisation, deletes projects, reads the activity log, and sees AI usage and sets its budget.",
};

export const ROLES: OrgRole[] = ["viewer", "editor", "approver", "owner"];

/** "a Viewer", "an Editor". */
export function roleWithArticle(role: OrgRole): string {
  const label = ROLE_LABELS[role];
  return `${/^[AEIOU]/.test(label) ? "an" : "a"} ${label}`;
}

export function roleIncludes(role: OrgRole, minimum: OrgRole): boolean {
  return ROLES.indexOf(role) >= ROLES.indexOf(minimum);
}

/** The organisation the app works in, and what the signed-in user may do there. */
export function useOrganisation() {
  const { user, organisation, switchOrganisation } = useAuth();
  return {
    current: organisation,
    organisations: user?.organisations ?? [],
    switchTo: switchOrganisation,
    can: (minimum: OrgRole) => Boolean(organisation && roleIncludes(organisation.role, minimum)),
  };
}

/** The sentence shown where a control is missing because of the user's role. */
export function needsRole(minimum: OrgRole, organisationName: string | undefined): string {
  return `Needs the ${ROLE_LABELS[minimum]} role${organisationName ? ` in ${organisationName}` : ""}.`;
}

/** "Sending email needs the Approver role in Northstar Ventures." (`action` starts the sentence). */
export function roleRequirement(action: string, minimum: OrgRole, organisationName: string | undefined): string {
  const requirement = needsRole(minimum, organisationName);
  return `${action} ${requirement.charAt(0).toLowerCase()}${requirement.slice(1)}`;
}
