import type { Page } from "@playwright/test";
import { getResponse } from "msw";
import { API, handlers, type FakeState } from "../../src/test/fakeApi";

/**
 * Serve the app's API from the same in-memory fake the component tests use, so
 * browser tests and component tests share one definition of the backend contract.
 * Every request is recorded on `state.requests`.
 */
export async function useFakeBackend(page: Page, state: FakeState, { signedIn = true } = {}) {
  const routes = handlers(state);
  await page.route("**/api/**", async (route) => {
    const incoming = route.request();
    const url = new URL(incoming.url());
    const sent = await incoming.allHeaders();
    const headers: Record<string, string> = {};
    for (const name of ["authorization", "content-type"]) {
      if (sent[name]) headers[name] = sent[name];
    }
    const method = incoming.method();
    if (url.pathname === "/api/events") {
      // A routed response can't stream, so the live updates stream opens and ends at once, as after a server
      // restart. The app reads the reconnection delay and opens it again 5 seconds later, without hot-looping.
      state.requests.push({ method, path: url.pathname, body: null });
      await route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }, body: "retry: 5000\n\n" });
      return;
    }
    // The API only exchanges JSON, so the body can travel as text.
    const body = method === "GET" || method === "HEAD" ? undefined : (incoming.postData() ?? undefined);
    const request = new Request(`${API}${url.pathname}${url.search}`, { method, headers, body });

    const response = await getResponse(routes, request);
    if (!response) {
      await route.fulfill({ status: 404, json: { detail: `No fake for ${method} ${url.pathname}` } });
      return;
    }
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  if (signedIn) {
    await page.addInitScript(() => localStorage.setItem("launchops_token", "token-1"));
  }
}

/** Recorded requests matching a method and path prefix. */
export function requestsTo(state: FakeState, method: string, pathPrefix: string) {
  return state.requests.filter((r) => r.method === method && r.path.startsWith(pathPrefix));
}
