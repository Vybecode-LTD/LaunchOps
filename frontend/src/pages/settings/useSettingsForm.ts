import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api/client";
import type { WorkspaceSettings } from "@/lib/api/types";
import { DEFAULT_SETTINGS, useSaveSettings, useSettings } from "@/lib/queries/hooks";
import { keys } from "@/lib/queries/keys";
import { useToast } from "@/components/ui/toast";

/**
 * Edit one slice of workspace settings. The API replaces the whole settings
 * object, so a save merges the edited slice into what the server last returned —
 * not into the display defaults — leaving every other setting exactly as stored.
 */
export function useSettingsSlice<K extends keyof WorkspaceSettings>(key: K) {
  const queryClient = useQueryClient();
  const settings = useSettings();
  const save = useSaveSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<WorkspaceSettings[K] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saved = settings.data?.[key];
  const value = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  const update = (patch: Partial<WorkspaceSettings[K]>) => {
    if (!value) return;
    setDraft({ ...(value as object), ...(patch as object) } as WorkspaceSettings[K]);
  };

  const commit = async (successTitle: string) => {
    if (!draft) return;
    const stored = queryClient.getQueryData<Partial<WorkspaceSettings>>(keys.settings()) ?? {};
    const base: WorkspaceSettings = {
      platforms: stored.platforms ?? {},
      brand: { ...DEFAULT_SETTINGS.brand, ...stored.brand },
      prefs: { ...DEFAULT_SETTINGS.prefs, ...stored.prefs },
    };
    setError(null);
    try {
      await save.mutateAsync({ ...base, [key]: draft });
      setDraft(null);
      toast.show({ title: successTitle });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return {
    value,
    loading: settings.isLoading,
    dirty,
    busy: save.isPending,
    error,
    update,
    reset: () => setDraft(null),
    commit,
  };
}
