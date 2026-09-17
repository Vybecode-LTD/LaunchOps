import { useOrganisation } from "@/lib/auth/organisation";
import { CHANNELS } from "@/lib/domain/channels";
import { Button } from "@/components/ui/Button";
import { Panel, Skeleton } from "@/components/ui/Display";
import { Input, Switch } from "@/components/ui/Field";
import { ViewOnlyFieldset, ViewOnlyNotice } from "@/components/access/Access";
import { useSettingsSlice } from "./useSettingsForm";
import styles from "./Settings.module.css";

export function ChannelsSettings() {
  const platforms = useSettingsSlice("platforms");
  const readOnly = !useOrganisation().can("editor");

  return (
    <div className={styles.stack}>
      {readOnly && <ViewOnlyNotice action="Changing them">You can view the channels.</ViewOnlyNotice>}
      <Panel
        title="Channels"
        flush
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={platforms.reset} disabled={!platforms.dirty}>
              Discard
            </Button>
            <Button size="sm" variant="primary" loading={platforms.busy} disabled={!platforms.dirty} onClick={() => void platforms.commit("Channels saved")}>
              Save
            </Button>
          </>
        }
      >
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--line)" }}>
          <p className={styles.lede}>
            LaunchOps doesn't connect to or post on these accounts. Channels marked In use are the defaults for social posts and content repurposing;
            handles are for your reference.
          </p>
          {platforms.error && (
            <p role="alert" style={{ color: "var(--crit)", fontSize: "var(--text-13)", marginTop: 8 }}>
              {platforms.error}
            </p>
          )}
        </div>
        {!platforms.value ? (
          <div style={{ padding: 16 }}>
            <Skeleton height={200} />
          </div>
        ) : (
          <ViewOnlyFieldset readOnly={readOnly}>
            {CHANNELS.map((channel) => {
              const cfg = platforms.value![channel.id] ?? { connected: false, handle: "", mode: "manual" as const };
              const set = (patch: Partial<typeof cfg>) => platforms.update({ [channel.id]: { ...cfg, ...patch } });
              return (
                <div key={channel.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{channel.name}</span>
                    <span className={styles.rowMeta}>{cfg.connected ? "In use" : "Not in use"}</span>
                  </div>
                  <div className={styles.rowControls}>
                    <Input
                      className={styles.handle}
                      value={cfg.handle}
                      onChange={(e) => set({ handle: e.target.value })}
                      placeholder="@handle"
                      aria-label={`${channel.name} handle`}
                    />
                    <Switch checked={cfg.connected} onCheckedChange={(v) => set({ connected: v })} label={`Use ${channel.name}`} />
                  </div>
                </div>
              );
            })}
          </ViewOnlyFieldset>
        )}
      </Panel>
    </div>
  );
}
