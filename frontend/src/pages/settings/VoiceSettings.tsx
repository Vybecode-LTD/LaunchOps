import { useOrganisation } from "@/lib/auth/organisation";
import { Button } from "@/components/ui/Button";
import { Panel, Skeleton } from "@/components/ui/Display";
import { Field, FieldRow, FieldStack, Input, Select, SwitchField, TagInput, Textarea } from "@/components/ui/Field";
import { ViewOnlyFieldset, ViewOnlyNotice } from "@/components/access/Access";
import { useSettingsSlice } from "./useSettingsForm";
import styles from "./Settings.module.css";

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "creative", label: "Creative and empowering" },
  { value: "edgy", label: "Edgy and bold" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
];

function Actions({ dirty, busy, error, onReset }: { dirty: boolean; busy: boolean; error: string | null; onReset: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
      {error && (
        <span role="alert" style={{ color: "var(--crit)", fontSize: "var(--text-13)", marginRight: "auto" }}>
          {error}
        </span>
      )}
      <Button variant="ghost" onClick={onReset} disabled={!dirty}>
        Discard changes
      </Button>
      <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
        Save
      </Button>
    </div>
  );
}

export function VoiceSettings() {
  const brand = useSettingsSlice("brand");
  const prefs = useSettingsSlice("prefs");
  const readOnly = !useOrganisation().can("editor");

  return (
    <div className={styles.stack}>
      {readOnly && <ViewOnlyNotice action="Changing them">You can view the brand voice and AI output preferences.</ViewOnlyNotice>}
      <Panel title="Brand voice">
        {!brand.value ? (
          <Skeleton height={200} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void brand.commit("Brand voice saved");
            }}
          >
            <ViewOnlyFieldset readOnly={readOnly}>
              <FieldStack>
                <p className={styles.lede}>
                  Sent with every operation for projects that don't have a company assigned. A project with an assigned company uses that company's
                  voice instead.
                </p>
                <FieldRow>
                  <Field label="Brand name">{(p) => <Input {...p} value={brand.value!.name} onChange={(e) => brand.update({ name: e.target.value })} />}</Field>
                  <Field label="Tagline" optional>
                    {(p) => <Input {...p} value={brand.value!.tagline} onChange={(e) => brand.update({ tagline: e.target.value })} />}
                  </Field>
                </FieldRow>
                <Field label="Elevator pitch" optional>
                  {(p) => <Textarea {...p} value={brand.value!.elevator} onChange={(e) => brand.update({ elevator: e.target.value })} rows={3} />}
                </Field>
                <Field label="Tone">
                  {(p) => (
                    <Select {...p} value={brand.value!.tone} onChange={(e) => brand.update({ tone: e.target.value })}>
                      {TONES.some((t) => t.value === brand.value!.tone) ? null : <option value={brand.value!.tone}>{brand.value!.tone}</option>}
                      {TONES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Keywords to weave in" optional>
                  {(p) => <TagInput id={p.id} value={brand.value!.keywords} onChange={(v) => brand.update({ keywords: v })} placeholder="no-code, creative tools" />}
                </Field>
                <Field label="Phrases to avoid" optional>
                  {(p) => <TagInput id={p.id} value={brand.value!.avoid} onChange={(v) => brand.update({ avoid: v })} placeholder="corporate jargon" />}
                </Field>
                <Actions dirty={brand.dirty} busy={brand.busy} error={brand.error} onReset={brand.reset} />
              </FieldStack>
            </ViewOnlyFieldset>
          </form>
        )}
      </Panel>

      <Panel title="AI output preferences">
        {!prefs.value ? (
          <Skeleton height={160} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void prefs.commit("Preferences saved");
            }}
          >
            <ViewOnlyFieldset readOnly={readOnly}>
              <FieldStack>
                <p className={styles.lede}>
                  Passed to the model as guidance with every operation. It shapes the output but doesn't guarantee a set number of sources or hashtags.
                </p>
                <FieldRow>
                  <Field label="Research depth">
                    {(p) => (
                      <Select {...p} value={prefs.value!.depth} onChange={(e) => prefs.update({ depth: e.target.value })}>
                        <option value="quick">Quick</option>
                        <option value="thorough">Thorough</option>
                        <option value="deep">Deep</option>
                      </Select>
                    )}
                  </Field>
                  <Field label="Content length">
                    {(p) => (
                      <Select {...p} value={prefs.value!.length} onChange={(e) => prefs.update({ length: e.target.value })}>
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </Select>
                    )}
                  </Field>
                  <Field label="Hashtags">
                    {(p) => (
                      <Select {...p} value={prefs.value!.hashtags} onChange={(e) => prefs.update({ hashtags: e.target.value })}>
                        <option value="none">None</option>
                        <option value="minimal">Minimal</option>
                        <option value="moderate">Moderate</option>
                        <option value="heavy">Heavy</option>
                      </Select>
                    )}
                  </Field>
                </FieldRow>
                <SwitchField label="Allow emoji in posts" checked={prefs.value.emoji} onCheckedChange={(v) => prefs.update({ emoji: v })} />
                <SwitchField label="Ask the model to cite sources" checked={prefs.value.sources} onCheckedChange={(v) => prefs.update({ sources: v })} />
                <Actions dirty={prefs.dirty} busy={prefs.busy} error={prefs.error} onReset={prefs.reset} />
              </FieldStack>
            </ViewOnlyFieldset>
          </form>
        )}
      </Panel>
    </div>
  );
}
