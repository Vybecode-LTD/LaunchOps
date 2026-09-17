import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, UNAUTHORIZED_EVENT, errorMessage, orgStore, tokenStore } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import type { AuthResponse, Membership, User } from "@/lib/api/types";

export type AuthState =
  | { status: "loading" }
  | { status: "offline"; message: string }
  | { status: "anonymous"; notice?: string }
  | { status: "authenticated"; user: User };

interface AuthApi {
  state: AuthState;
  user: User | null;
  /** The organisation the app is working in: the one last chosen, or the user's first. */
  organisation: Membership | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  /** Sign in with a session the API already created (e.g. registering through an invitation). */
  signIn: (result: AuthResponse, organisationId?: string) => void;
  logout: () => void;
  retry: () => void;
  /** Work in another of the user's organisations; everything reloads for it. */
  switchOrganisation: (organisationId: string) => void;
  /** Reload the user's profile and organisations (after joining, leaving or renaming one), optionally working in `organisationId`. */
  refreshUser: (organisationId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

function initialState(): AuthState {
  return tokenStore.get() ? { status: "loading" } : { status: "anonymous" };
}

/**
 * Keep the stored organisation one the user belongs to, before anything is fetched for it.
 * A stale choice (left or removed since) would make every request answer "Organisation not found".
 */
function choosableOrganisation(user: User, preferred?: string | null): Membership | null {
  const organisations = user.organisations ?? [];
  const chosen = organisations.find((o) => o.id === (preferred ?? orgStore.get())) ?? organisations[0] ?? null;
  if (chosen) orgStore.set(chosen.id);
  else orgStore.clear();
  return chosen;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(initialState);
  const [attempt, setAttempt] = useState(0);
  const [organisationId, setOrganisationId] = useState<string | null>(() => orgStore.get());

  const authenticate = useCallback((user: User, preferredOrganisation?: string | null) => {
    setOrganisationId(choosableOrganisation(user, preferredOrganisation)?.id ?? null);
    setState({ status: "authenticated", user });
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    authApi
      .me()
      .then((user) => {
        if (!cancelled) authenticate(user);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A server that's unreachable or failing (5xx, e.g. a database outage) can be retried; only a rejected session signs out.
        if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
          setState({ status: "offline", message: err.message });
        } else {
          tokenStore.clear();
          setState({ status: "anonymous" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, authenticate]);

  useEffect(() => {
    const onUnauthorized = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      queryClient.clear();
      setState({
        status: "anonymous",
        notice: detail === "Account is disabled" ? "This account has been disabled. Contact an administrator." : "Your session ended. Sign in again to continue.",
      });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  const signIn = useCallback(
    (result: AuthResponse, preferredOrganisation?: string) => {
      tokenStore.set(result.token);
      queryClient.clear();
      authenticate(result.user, preferredOrganisation);
    },
    [queryClient, authenticate],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      signIn(await authApi.login(email, password));
    },
    [signIn],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      signIn(await authApi.register(name, email, password));
    },
    [signIn],
  );

  const logout = useCallback(() => {
    // Revokes the refresh cookie's session; signing out here doesn't wait for it
    void authApi.logout().catch(() => undefined);
    tokenStore.clear();
    orgStore.clear();
    queryClient.clear();
    setState({ status: "anonymous" });
  }, [queryClient]);

  const switchOrganisation = useCallback(
    (id: string) => {
      if (state.status !== "authenticated" || !state.user.organisations.some((o) => o.id === id)) return;
      orgStore.set(id);
      setOrganisationId(id);
      // Every cached list belongs to the previous organisation
      void queryClient.resetQueries();
    },
    [state, queryClient],
  );

  const refreshUser = useCallback(async (organisationId?: string) => {
    const user = await authApi.me();
    const previous = orgStore.get();
    const chosen = choosableOrganisation(user, organisationId ?? previous);
    setOrganisationId(chosen?.id ?? null);
    setState({ status: "authenticated", user });
    if (chosen?.id !== previous) void queryClient.resetQueries();
  }, [queryClient]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const api = useMemo<AuthApi>(() => {
    const user = state.status === "authenticated" ? state.user : null;
    const organisation = user ? (user.organisations.find((o) => o.id === organisationId) ?? user.organisations[0] ?? null) : null;
    return { state, user, organisation, login, register, signIn, logout, retry, switchOrganisation, refreshUser };
  }, [state, organisationId, login, register, signIn, logout, retry, switchOrganisation, refreshUser]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export { errorMessage };
