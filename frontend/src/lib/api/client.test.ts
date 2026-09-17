import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { API } from "@/test/fakeApi";
import { ApiError, UNAUTHORIZED_EVENT, errorMessage, openEventStream, orgStore, request, tokenStore } from "./client";

afterEach(() => vi.restoreAllMocks());

const eventStream = (text: string) => new HttpResponse(text, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });

describe("openEventStream", () => {
  it("sends the session's headers and resolves with the stream", async () => {
    tokenStore.set("abc");
    orgStore.set("org-7");
    let seen: Record<string, string | null> | null = null;
    server.use(
      http.get(`${API}/api/events`, ({ request: req }) => {
        seen = { auth: req.headers.get("authorization"), org: req.headers.get("x-org-id"), accept: req.headers.get("accept") };
        return eventStream("retry: 5000\n\n");
      }),
    );

    const body = await openEventStream("/api/events", new AbortController().signal);

    expect(await new Response(body).text()).toBe("retry: 5000\n\n");
    expect(seen).toEqual({ auth: "Bearer abc", org: "org-7", accept: "text/event-stream" });
    orgStore.clear();
  });

  it("renews an expired session once and opens the stream with the new token", async () => {
    tokenStore.set("expired");
    const seen: Array<string | null> = [];
    server.use(
      http.get(`${API}/api/events`, ({ request: req }) => {
        seen.push(req.headers.get("authorization"));
        return req.headers.get("authorization") === "Bearer renewed"
          ? eventStream(": keep-alive\n\n")
          : HttpResponse.json({ detail: "Invalid or expired token" }, { status: 401 });
      }),
      http.post(`${API}/api/auth/refresh`, () => HttpResponse.json({ token: "renewed", user: {} })),
    );

    await expect(openEventStream("/api/events", new AbortController().signal)).resolves.toBeInstanceOf(ReadableStream);
    expect(seen).toEqual(["Bearer expired", "Bearer renewed"]);
  });

  it("ends the session when it can't be renewed, as request() does", async () => {
    tokenStore.set("expired");
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    server.use(
      http.get(`${API}/api/events`, () => HttpResponse.json({ detail: "Invalid or expired token" }, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => HttpResponse.json({ detail: "Your session has ended. Sign in again." }, { status: 401 })),
    );

    await expect(openEventStream("/api/events", new AbortController().signal)).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("rejects a refusal with the server's reason", async () => {
    tokenStore.set("abc");
    server.use(http.get(`${API}/api/events`, () => HttpResponse.json({ detail: "Organisation not found" }, { status: 404 })));
    await expect(openEventStream("/api/events", new AbortController().signal)).rejects.toMatchObject({ status: 404, message: "Organisation not found" });
  });

  it("rejects an answer that isn't an event stream, such as a page served in its place", async () => {
    server.use(http.get(`${API}/api/events`, () => HttpResponse.html("<!doctype html><title>LaunchOps</title>")));
    await expect(openEventStream("/api/events", new AbortController().signal)).rejects.toMatchObject({
      status: 200,
      message: "The server didn't answer with a live update stream.",
    });
  });

  it("reports an unreachable server plainly", async () => {
    server.use(http.get(`${API}/api/events`, () => HttpResponse.error()));
    await expect(openEventStream("/api/events", new AbortController().signal)).rejects.toMatchObject({ status: 0 });
  });
});

describe("request", () => {
  it("sends the bearer token and JSON body", async () => {
    tokenStore.set("abc");
    let seen: { auth: string | null; body: unknown } | null = null;
    server.use(
      http.post(`${API}/api/things`, async ({ request: req }) => {
        seen = { auth: req.headers.get("authorization"), body: await req.json() };
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(request("/api/things", { method: "POST", body: { a: 1 } })).resolves.toEqual({ ok: true });
    expect(seen).toEqual({ auth: "Bearer abc", body: { a: 1 } });
  });

  it("uses FastAPI's string detail as the message", async () => {
    server.use(http.get(`${API}/api/x`, () => HttpResponse.json({ detail: "Brand not found" }, { status: 400 })));
    await expect(request("/api/x")).rejects.toMatchObject({ status: 400, message: "Brand not found" });
  });

  it("joins validation error messages", async () => {
    server.use(
      http.get(`${API}/api/x`, () =>
        HttpResponse.json({ detail: [{ msg: "Field required" }, { msg: "String too short" }] }, { status: 422 }),
      ),
    );
    await expect(request("/api/x")).rejects.toMatchObject({ message: "Field required; String too short" });
  });

  it("falls back to the status line when the body isn't JSON", async () => {
    server.use(http.get(`${API}/api/x`, () => new HttpResponse("Internal Server Error", { status: 500, statusText: "Internal Server Error" })));
    await expect(request("/api/x")).rejects.toMatchObject({ message: "Request failed (500 Internal Server Error)" });
  });

  it("renews an expired access token once and retries the request", async () => {
    tokenStore.set("expired");
    const seen: Array<string | null> = [];
    server.use(
      http.get(`${API}/api/products`, ({ request: req }) => {
        seen.push(req.headers.get("authorization"));
        return req.headers.get("authorization") === "Bearer renewed"
          ? HttpResponse.json([{ id: "project-1" }])
          : HttpResponse.json({ detail: "Invalid or expired token" }, { status: 401 });
      }),
      http.post(`${API}/api/auth/refresh`, () => HttpResponse.json({ token: "renewed", user: {} })),
    );

    await expect(request("/api/products")).resolves.toEqual([{ id: "project-1" }]);
    expect(seen).toEqual(["Bearer expired", "Bearer renewed"]);
    expect(tokenStore.get()).toBe("renewed");
  });

  it("shares one renewal between requests that fail together", async () => {
    tokenStore.set("expired");
    let renewals = 0;
    server.use(
      http.get(`${API}/api/:thing`, ({ request: req }) =>
        req.headers.get("authorization") === "Bearer renewed"
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ detail: "Invalid or expired token" }, { status: 401 }),
      ),
      http.post(`${API}/api/auth/refresh`, () => {
        renewals += 1;
        return HttpResponse.json({ token: "renewed", user: {} });
      }),
    );

    await expect(Promise.all([request("/api/a"), request("/api/b"), request("/api/c")])).resolves.toHaveLength(3);
    expect(renewals).toBe(1);
  });

  it("doesn't try to renew after a sign-in attempt fails", async () => {
    tokenStore.set("old");
    let renewals = 0;
    server.use(
      http.post(`${API}/api/auth/login`, () => HttpResponse.json({ detail: "Invalid email or password" }, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => {
        renewals += 1;
        return HttpResponse.json({ token: "renewed", user: {} });
      }),
    );
    await expect(request("/api/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({ status: 401 });
    expect(renewals).toBe(0);
    expect(tokenStore.get()).toBe("old");
  });

  it("sends the chosen organisation with signed-in requests", async () => {
    tokenStore.set("abc");
    orgStore.set("org-7");
    let org: string | null = null;
    server.use(
      http.get(`${API}/api/products`, ({ request: req }) => {
        org = req.headers.get("x-org-id");
        return HttpResponse.json([]);
      }),
    );
    await request("/api/products");
    expect(org).toBe("org-7");
    orgStore.clear();
  });

  it("ends the session on 401 when it can't be renewed, and tells the app why", async () => {
    tokenStore.set("expired");
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    server.use(
      http.get(`${API}/api/products`, () => HttpResponse.json({ detail: "Account is disabled" }, { status: 401 })),
      http.post(`${API}/api/auth/refresh`, () => HttpResponse.json({ detail: "Your session has ended. Sign in again." }, { status: 401 })),
    );

    await expect(request("/api/products")).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.get()).toBeNull();
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toBe("Account is disabled");
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("reports an unreachable server plainly", async () => {
    server.use(http.get(`${API}/api/x`, () => HttpResponse.error()));
    await expect(request("/api/x")).rejects.toMatchObject({ status: 0, message: "Can't reach the LaunchOps server. Check your connection and try again." });
  });
});

describe("tokenStore", () => {
  it("treats a browser that blocks storage as signed out instead of crashing", () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);

    expect(() => tokenStore.set("abc")).not.toThrow();
    expect(tokenStore.get()).toBeNull();
    expect(() => tokenStore.clear()).not.toThrow();
  });
});

describe("errorMessage", () => {
  it("uses an error's own message", () => {
    expect(errorMessage(new ApiError(409, "An account with this email already exists"))).toBe("An account with this email already exists");
  });

  it("falls back to a general message for anything that isn't an error", () => {
    expect(errorMessage("timeout")).toBe("Something went wrong.");
    expect(errorMessage(undefined)).toBe("Something went wrong.");
  });
});
