import { useNavigate } from "react-router";
import { Building2, ChevronsUpDown, Users } from "lucide-react";
import { ROLE_LABELS, useOrganisation } from "@/lib/auth/organisation";
import { routes } from "@/lib/routes";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Overlay";
import styles from "./Shell.module.css";

/** The organisation the app is working in, with a menu to switch to another one. */
export function OrganisationSwitcher() {
  const { current, organisations, switchTo } = useOrganisation();
  const navigate = useNavigate();
  if (!current) return null;

  return (
    <div className={styles.orgSwitcher}>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" className={styles.orgButton} aria-label={`Organisation: ${current.name}, your role: ${ROLE_LABELS[current.role]}. Switch organisation`}>
            <Building2 aria-hidden="true" className={styles.orgIcon} />
            <span className={styles.userText}>
              <span className={styles.userName}>{current.name}</span>
              <span className={styles.userEmail}>{ROLE_LABELS[current.role]}</span>
            </span>
            <ChevronsUpDown size={14} aria-hidden="true" style={{ marginLeft: "auto", color: "var(--ink-3)", flexShrink: 0 }} />
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>Organisations</MenuLabel>
          {organisations.map((organisation) => (
            <MenuItem
              key={organisation.id}
              onSelect={() => {
                if (organisation.id === current.id) return;
                switchTo(organisation.id);
                navigate(routes.portfolio);
              }}
              shortcut={organisation.id === current.id ? "✓" : ROLE_LABELS[organisation.role]}
            >
              {organisation.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={<Users aria-hidden="true" />} onSelect={() => navigate(routes.settings("organisation"))}>
            Members and invitations
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
