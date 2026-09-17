import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOrganisation } from "@/lib/auth/organisation";
import { useTheme, type ThemePreference } from "@/lib/hooks/useTheme";
import { safeUrl } from "@/lib/domain/values";
import { Button } from "@/components/ui/Button";
import { Definitions, Panel, Segmented, Skeleton } from "@/components/ui/Display";
import { Field, FieldStack, Input } from "@/components/ui/Field";
import { Wordmark } from "@/components/shell/Wordmark";
import { ViewOnlyFieldset, ViewOnlyNotice } from "@/components/access/Access";
import { useSettingsSlice } from "./useSettingsForm";
import styles from "./Settings.module.css";

export function GeneralSettings() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useTheme();
  const brand = useSettingsSlice("brand");
  // The branding belongs to the organisation: changing it needs the Editor role. Appearance is this browser's own.
  const readOnly = !useOrganisation().can("editor");
  const [logoFailed, setLogoFailed] = useState<string | null>(null);

  const logoUrl = brand.value?.logo_url ?? "";
  const validLogo = logoUrl ? safeUrl(logoUrl) : null;

  return (
    <div className={styles.stack}>
      <Panel title="Workspace branding">
        {brand.loading || !brand.value ? (
          <Skeleton height={120} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void brand.commit("Branding saved");
            }}
          >
            <FieldStack>
              {readOnly && <ViewOnlyNotice action="Changing it">You can view the workspace branding.</ViewOnlyNotice>}
              <p className={styles.lede}>Shown at the top of the navigation when you're signed in.</p>
              <ViewOnlyFieldset readOnly={readOnly}>
                <Field label="Company name" optional hint="Appears under the LaunchOps wordmark.">
                  {(p) => <Input {...p} value={brand.value!.company_name} onChange={(e) => brand.update({ company_name: e.target.value })} />}
                </Field>
                <Field
                  label="Logo URL"
                  optional
                  hint="An https link to a PNG or SVG. It replaces the wordmark; about 32px tall is displayed."
                  error={logoUrl && !validLogo ? "Enter a full https:// address." : logoFailed === logoUrl && logoUrl ? "That image couldn't be loaded." : null}
                >
                  {(p) => <Input {...p} type="url" mono value={logoUrl} onChange={(e) => brand.update({ logo_url: e.target.value })} placeholder="https://" />}
                </Field>
                <div className={styles.logoPreview} aria-label="Navigation preview">
                  <span className="placard">Preview</span>
                  {validLogo && logoFailed !== logoUrl ? (
                    <img src={validLogo} alt={brand.value.company_name || "Logo"} onError={() => setLogoFailed(logoUrl)} />
                  ) : (
                    <Wordmark companyName={brand.value.company_name || undefined} />
                  )}
                </div>
                {brand.error && (
                  <div role="alert" style={{ color: "var(--crit)", fontSize: "var(--text-13)" }}>
                    {brand.error}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <Button variant="ghost" onClick={brand.reset} disabled={!brand.dirty}>
                    Discard changes
                  </Button>
                  <Button type="submit" variant="primary" loading={brand.busy} disabled={!brand.dirty || Boolean(logoUrl && !validLogo)}>
                    Save
                  </Button>
                </div>
              </ViewOnlyFieldset>
            </FieldStack>
          </form>
        )}
      </Panel>

      <Panel title="Appearance">
        <FieldStack>
          <Segmented<ThemePreference>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: "Match system" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <p className={styles.lede}>Saved in this browser only.</p>
        </FieldStack>
      </Panel>

      <Panel title="Your account" actions={<Button variant="secondary" size="sm" onClick={logout}>Sign out</Button>}>
        <Definitions
          items={[
            ["Name", user?.name || "—"],
            ["Email", user?.email],
            ["Role", user?.role === "admin" ? "Administrator" : "Member"],
          ]}
        />
      </Panel>
    </div>
  );
}
