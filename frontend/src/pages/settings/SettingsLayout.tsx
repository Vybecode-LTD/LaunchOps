import { Outlet } from "react-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOrganisation } from "@/lib/auth/organisation";
import { routes } from "@/lib/routes";
import { PageHeader } from "@/components/ui/Display";
import { TabNav } from "@/components/ui/TabNav";
import styles from "./Settings.module.css";

export function SettingsLayout() {
  const { user } = useAuth();
  const { current, can } = useOrganisation();
  return (
    <>
      <PageHeader title="Settings" lede={`These settings apply to every project in ${current?.name ?? "your organisation"}.`} />
      <div className={styles.tabs}>
        <TabNav
          label="Settings sections"
          items={[
            { to: routes.settings(), label: "General", end: true },
            { to: routes.settings("voice"), label: "Voice & AI" },
            { to: routes.settings("companies"), label: "Companies" },
            { to: routes.settings("channels"), label: "Channels" },
            { to: routes.settings("organisation"), label: "Organisation" },
            ...(can("owner")
              ? [
                  { to: routes.settings("activity"), label: "Activity" },
                  { to: routes.settings("usage"), label: "Usage" },
                ]
              : []),
            ...(user?.role === "admin" ? [{ to: routes.settings("team"), label: "Team & access" }] : []),
          ]}
        />
      </div>
      <Outlet />
    </>
  );
}
