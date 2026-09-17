import { useCallback, useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api/client";
import {
  adminApi,
  brandsApi,
  calendarApi,
  capturesApi,
  emailApi,
  invitationsApi,
  operationsApi,
  organisationApi,
  projectsApi,
  queueApi,
  settingsApi,
  templatesApi,
} from "@/lib/api/endpoints";
import type {
  BrandInput,
  CalendarEvent,
  CalendarEventCreate,
  CalendarEventUpdate,
  Capture,
  Checklist,
  EmailDraftUpdate,
  EmailItem,
  OrgRole,
  Project,
  ProjectCreate,
  ProjectUpdate,
  QueueItem,
  QueueStatus,
  Template,
  TemplateCreate,
  WorkspaceSettings,
} from "@/lib/api/types";
import { CHANNELS } from "@/lib/domain/channels";
import { queuePollInterval } from "@/lib/domain/queue";
import { isPendingDelete, scheduleDelete, usePendingDeletesVersion } from "@/lib/hooks/deferredDelete";
import { useLiveUpdates } from "@/lib/live/liveContext";
import { useToast } from "@/components/ui/toast";
import { keys } from "./keys";

/**
 * A list selector that hides items with a pending (undoable) delete. Its
 * identity changes with the pending set, which makes React Query re-run it.
 */
function useWithoutPending<T extends { id: string }>() {
  const version = usePendingDeletesVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the cache-buster
  return useMemo(() => (items: T[]) => items.filter((item) => !isPendingDelete(item.id)), [version]);
}

/* ─── Projects ─── */

export function useProjects() {
  const select = useWithoutPending<Project>();
  return useQuery({ queryKey: keys.projectList(), queryFn: projectsApi.list, select });
}

export function useProject(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: keys.project(id ?? ""),
    queryFn: () => projectsApi.get(id!),
    enabled: Boolean(id),
    placeholderData: () => queryClient.getQueryData<Project[]>(keys.projectList())?.find((p) => p.id === id),
  });
}

function storeProject(queryClient: ReturnType<typeof useQueryClient>, project: Project) {
  queryClient.setQueryData(keys.project(project.id), project);
  queryClient.setQueryData<Project[]>(keys.projectList(), (list) =>
    list ? list.map((p) => (p.id === project.id ? project : p)) : list,
  );
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreate) => projectsApi.create(data),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(keys.projectList(), (list) => (list ? [project, ...list] : [project]));
      queryClient.setQueryData(keys.project(project.id), project);
    },
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectUpdate) => projectsApi.update(id, data),
    onSuccess: (project) => storeProject(queryClient, project),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Project[]>(keys.projectList(), (list) => list?.filter((p) => p.id !== id));
      queryClient.removeQueries({ queryKey: keys.project(id) });
      void queryClient.invalidateQueries({ queryKey: keys.queueAll });
      void queryClient.invalidateQueries({ queryKey: keys.emailsAll });
      void queryClient.invalidateQueries({ queryKey: keys.calendar() });
      void queryClient.invalidateQueries({ queryKey: keys.captures() });
    },
  });
}

/** Checklist changes apply instantly and roll back if the save fails. */
export function useUpdateChecklist(id: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationKey: ["checklist", id],
    // Saves send the whole checklist, so they must reach the server in order.
    scope: { id: `checklist-${id}` },
    mutationFn: (checklist: Checklist) => projectsApi.updateChecklist(id, checklist),
    onMutate: async (checklist) => {
      await queryClient.cancelQueries({ queryKey: keys.project(id) });
      // Arriving from the portfolio, the page renders from the cached list while the full project
      // loads. Without this fallback a tick wouldn't show, and a second tick would drop the first.
      const previous =
        queryClient.getQueryData<Project>(keys.project(id)) ??
        queryClient.getQueryData<Project[]>(keys.projectList())?.find((p) => p.id === id);
      if (previous) storeProject(queryClient, { ...previous, checklist });
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) storeProject(queryClient, context.previous);
      toast.show({ title: "Launch plan not saved", description: errorMessage(err), tone: "crit" });
    },
    // Rapid ticks overlap: only reconcile with the server once the last save settles,
    // so an earlier response can't briefly undo a later tick.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["checklist", id] }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: keys.project(id) });
        void queryClient.invalidateQueries({ queryKey: keys.projectList() });
      }
    },
  });
}

/* ─── Review queue ─── */

/** Results. While any is running the list is polled: often without live updates, rarely as a safety net with them. */
export function useQueue(params: { product_id?: string; status?: QueueStatus; limit?: number } = {}) {
  const select = useWithoutPending<QueueItem>();
  const { connected } = useLiveUpdates();
  return useQuery({
    queryKey: keys.queue(params),
    queryFn: () => queueApi.list(params),
    select,
    refetchInterval: (query) => queuePollInterval(query.state.data, connected),
  });
}

/** Cancel a running operation. The lists refetch either way: it failed, is stopping, or had already finished. */
export function useCancelOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => queueApi.cancel(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.queueAll }),
  });
}

export function useLaunchWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { productId: string; workflowId: string; instructions: string }) =>
      operationsApi.launchWorkflow(vars.productId, vars.workflowId, vars.instructions),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.queueAll });
    },
  });
}

export function useReviewItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: "approved" | "rejected" | "pending"; notes?: string }) =>
      queueApi.review(vars.id, vars.status, vars.notes ?? ""),
    onSuccess: (item) => {
      queryClient.setQueriesData<QueueItem[]>({ queryKey: ["queue", "list"] }, (list) =>
        list?.map((q) => (q.id === item.id ? { ...q, ...item } : q)),
      );
      void queryClient.invalidateQueries({ queryKey: keys.queueAll });
      // Drafts are extracted by a background task after the response is sent.
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: keys.emailsAll }), 1500);
    },
  });
}

/* ─── Outbox ─── */

export function useEmails(params: { product_id?: string } = {}) {
  const select = useWithoutPending<EmailItem>();
  return useQuery({ queryKey: keys.emails(params), queryFn: () => emailApi.list(params), select });
}

export function useUpdateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; data: EmailDraftUpdate }) => emailApi.update(vars.id, vars.data),
    onSuccess: (email) => {
      queryClient.setQueriesData<EmailItem[]>({ queryKey: ["emails", "list"] }, (list) =>
        list?.map((e) => (e.id === email.id ? email : e)),
      );
    },
  });
}

/** Refreshed with the email lists after every send (both sit under keys.emailsAll). */
export function useEmailQuota() {
  return useQuery({ queryKey: keys.emailQuota(), queryFn: emailApi.quota });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailApi.send(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.emailsAll }),
  });
}

/* ─── Library ─── */

export function useTemplates() {
  const select = useWithoutPending<Template>();
  return useQuery({ queryKey: keys.templates(), queryFn: templatesApi.list, select });
}

export function useTemplatesFor(workflowId: string | undefined) {
  const select = useWithoutPending<Template>();
  return useQuery({
    queryKey: keys.templatesFor(workflowId ?? ""),
    queryFn: () => templatesApi.forWorkflow(workflowId!),
    enabled: Boolean(workflowId),
    select,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TemplateCreate) => templatesApi.create(data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useCaptures() {
  const select = useWithoutPending<Capture>();
  return useQuery({ queryKey: keys.captures(), queryFn: capturesApi.list, select });
}

export function useCreateCapture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { text: string; productId: string }) => capturesApi.create(vars.text, vars.productId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.captures() }),
  });
}

/* ─── Calendar ─── */

export function useCalendar() {
  const select = useWithoutPending<CalendarEvent>();
  return useQuery({ queryKey: keys.calendar(), queryFn: calendarApi.list, select });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CalendarEventCreate) => calendarApi.create(data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.calendar() }),
  });
}

/** Entry edits and moves apply instantly and roll back if the save fails. */
export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    // A move and its undo must reach the server in order.
    scope: { id: "calendar-events" },
    mutationFn: ({ id, patch }: { id: string; patch: CalendarEventUpdate }) => calendarApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: keys.calendar() });
      const previous = queryClient.getQueryData<CalendarEvent[]>(keys.calendar());
      queryClient.setQueryData<CalendarEvent[]>(keys.calendar(), (list) =>
        list?.map((event) => (event.id === id ? { ...event, ...patch } : event)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(keys.calendar(), context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.calendar() }),
  });
}

/** Moves a project's launch date from anywhere (e.g. the calendar), optimistically. */
export function useSetLaunchDate() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: "launch-dates" },
    mutationFn: ({ id, launchDate }: { id: string; launchDate: string | null }) =>
      projectsApi.update(id, { launch_date: launchDate }),
    onMutate: async ({ id, launchDate }) => {
      await queryClient.cancelQueries({ queryKey: keys.projects });
      const list = queryClient.getQueryData<Project[]>(keys.projectList());
      const detail = queryClient.getQueryData<Project>(keys.project(id));
      queryClient.setQueryData<Project[]>(keys.projectList(), (all) =>
        all?.map((p) => (p.id === id ? { ...p, launch_date: launchDate } : p)),
      );
      if (detail) queryClient.setQueryData(keys.project(id), { ...detail, launch_date: launchDate });
      return { list, detail };
    },
    onError: (_err, { id }, context) => {
      if (context?.list) queryClient.setQueryData(keys.projectList(), context.list);
      if (context?.detail) queryClient.setQueryData(keys.project(id), context.detail);
    },
    onSuccess: (project) => storeProject(queryClient, project),
  });
}

/* ─── Settings ─── */

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  platforms: Object.fromEntries(
    CHANNELS.map((c) => [c.id, { connected: false, handle: "", mode: "manual" as const }]),
  ),
  brand: { name: "", tagline: "", tone: "professional", keywords: [], avoid: [], elevator: "", company_name: "", logo_url: "" },
  prefs: { depth: "thorough", length: "medium", emoji: true, hashtags: "moderate", sources: true },
};

export function normalizeSettings(raw: Partial<WorkspaceSettings> | undefined): WorkspaceSettings {
  return {
    platforms: { ...DEFAULT_SETTINGS.platforms, ...(raw?.platforms ?? {}) },
    brand: { ...DEFAULT_SETTINGS.brand, ...(raw?.brand ?? {}) },
    prefs: { ...DEFAULT_SETTINGS.prefs, ...(raw?.prefs ?? {}) },
  };
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings(), queryFn: settingsApi.get, select: normalizeSettings });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkspaceSettings) => settingsApi.save(data),
    onSuccess: (_, data) => queryClient.setQueryData(keys.settings(), data),
  });
}

/* ─── Companies (brands) ─── */

export function useBrands() {
  return useQuery({ queryKey: keys.brands(), queryFn: brandsApi.list });
}

export function useSaveBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; data: BrandInput }) =>
      vars.id ? brandsApi.update(vars.id, vars.data) : brandsApi.create(vars.data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.brands() }),
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.brands() });
      void queryClient.invalidateQueries({ queryKey: keys.projects });
    },
  });
}

/* ─── Admin ─── */

/* ─── Organisation: members, invitations, activity ─── */

export function useOrganisationMembers() {
  return useQuery({ queryKey: keys.organisationMembers(), queryFn: organisationApi.members });
}

export function useChangeMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) => organisationApi.changeRole(userId, role),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.organisationMembers() }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => organisationApi.removeMember(userId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.organisationMembers() }),
  });
}

export function useInvitations(enabled: boolean) {
  return useQuery({ queryKey: keys.organisationInvitations(), queryFn: organisationApi.invitations, enabled });
}

export function useInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: OrgRole }) => organisationApi.invite(email, role),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.organisationInvitations() }),
  });
}

export function useWithdrawInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organisationApi.withdrawInvitation(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.organisationInvitations() }),
  });
}

export const ACTIVITY_PAGE = 50;

export function useActivity(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: keys.organisationActivity(),
    queryFn: ({ pageParam }) => organisationApi.activity({ limit: ACTIVITY_PAGE, before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length === ACTIVITY_PAGE ? last[last.length - 1]?.id : undefined),
    enabled,
  });
}

/** A UTC month's AI usage and the budget (owners only). While another month loads, the last one stands in (isPlaceholderData). */
export function useUsage(month: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.organisationUsage(month),
    queryFn: () => organisationApi.usage(month),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSetBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number | null) => organisationApi.setBudget(amount),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.organisationUsageAll }),
  });
}

export function useInvitationDetails(token: string) {
  return useQuery({ queryKey: keys.invitation(token), queryFn: () => invitationsApi.describe(token), retry: false });
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({ queryKey: keys.adminUsers(), queryFn: adminApi.users, enabled });
}

export function useAdminProjects(enabled: boolean) {
  return useQuery({ queryKey: keys.adminProjects(), queryFn: adminApi.projects, enabled });
}

export function useRegistration(enabled: boolean) {
  return useQuery({ queryKey: keys.adminRegistration(), queryFn: adminApi.registration, enabled });
}

/* ─── Undoable delete ─── */

interface UndoableDeleteInput {
  id: string;
  /** e.g. "Template" — used in "Template deleted". */
  noun: string;
  /** List query key prefixes the item appears under. */
  listKeys: QueryKey[];
  remove: (id: string, keepalive: boolean) => Promise<unknown>;
  onCommitted?: () => void;
}

export const UNDO_WINDOW_MS = 6000;

export function useUndoableDelete() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useCallback(
    ({ id, noun, listKeys, remove, onCommitted }: UndoableDeleteInput) => {
      const refresh = () => listKeys.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
      const cancel = scheduleDelete(
        `${noun}:${id}`,
        id,
        async (keepalive) => {
          try {
            await remove(id, keepalive);
            onCommitted?.();
          } catch (err) {
            if (!keepalive) toast.show({ title: `${noun} not deleted`, description: errorMessage(err), tone: "crit" });
          } finally {
            refresh();
          }
        },
        UNDO_WINDOW_MS,
      );
      toast.show({
        title: `${noun} deleted`,
        tone: "info",
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: () => {
            if (cancel()) refresh();
          },
        },
      });
    },
    [queryClient, toast],
  );
}
