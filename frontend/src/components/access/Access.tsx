import type { ReactNode } from "react";
import type { OrgRole } from "@/lib/api/types";
import { roleRequirement, useOrganisation } from "@/lib/auth/organisation";
import { Notice } from "@/components/ui/Display";
import styles from "./Access.module.css";

/*
 * How the interface shows what the user's role in the organisation allows (docs/PHASE1_DESIGN.md, D2).
 * The backend refuses the same changes (backend/services/access.py); these keep people from reaching for them:
 * - an action the role can't take isn't rendered, and where that would leave a confusing gap, a RoleNote says why;
 * - a form the role can't save stays readable, with its controls disabled and one ViewOnlyNotice at the top.
 */

interface RequirementProps {
  /** What needs the role, as the start of a sentence: "Sending email", "Changing them". */
  action: string;
  minimum: OrgRole;
}

/** "Sending email needs the Approver role in Northstar Ventures." */
export function RoleRequirement({ action, minimum }: RequirementProps) {
  const { current } = useOrganisation();
  return <>{roleRequirement(action, minimum, current?.name)}</>;
}

/** A short line in place of a control the user's role doesn't allow. */
export function RoleNote(props: RequirementProps) {
  return (
    <p className={styles.roleNote}>
      <RoleRequirement {...props} />
    </p>
  );
}

/** The notice at the top of a form the user can read but not change: what they can do, then what changing it needs. */
export function ViewOnlyNotice({ children, action, minimum = "editor" }: { children: string; action: string; minimum?: OrgRole }) {
  return (
    <Notice tone="info">
      {children} <RoleRequirement action={action} minimum={minimum} />
    </Notice>
  );
}

/** Disables every control inside when `readOnly`, so the values stay readable but can't be changed. */
export function ViewOnlyFieldset({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  if (!readOnly) return <>{children}</>;
  return (
    <fieldset disabled className={styles.viewOnly}>
      {children}
    </fieldset>
  );
}
