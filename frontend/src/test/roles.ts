import type { OrgRole } from "@/lib/api/types";
import { makeState, type FakeState } from "./fakeApi";

/** The fake API's state, signed in as a member of Northstar Ventures (org-1) with `role` instead of the default Owner. */
export function stateAs(role: OrgRole, partial: Partial<FakeState> = {}): FakeState {
  const state = makeState(partial);
  state.user = { ...state.user, organisations: [{ id: "org-1", name: "Northstar Ventures", role }] };
  state.members = state.members.map((m) => (m.org_id === "org-1" && m.user_id === state.user.id ? { ...m, role } : m));
  return state;
}

/**
 * Requests that would change the organisation's data: anything but a read. Session requests (sign-in, renewal)
 * aren't counted. The fake API records refused requests too, so an empty list also means nothing was refused.
 */
export function changesRequested(state: FakeState) {
  return state.requests.filter((r) => r.method !== "GET" && !r.path.startsWith("/api/auth/"));
}
