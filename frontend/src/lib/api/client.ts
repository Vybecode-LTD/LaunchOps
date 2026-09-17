const TOKEN_KEY = "launchops_token";
const ORG_KEY = "launchops_org";
const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";

export const UNAUTHORIZED_EVENT = "launchops:unauthorized";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: the session lasts for this page only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** The organisation requests act on (sent as X-Org-Id). Without one, the API uses the user's first organisation. */
export const orgStore = {
  get(): string | null {
    try {
      return localStorage.getItem(ORG_KEY);
    } catch {
      return null;
    }
  },
  set(orgId: string) {
    try {
      localStorage.setItem(ORG_KEY, orgId);
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ORG_KEY);
    } catch {
      /* ignore */
    }
  },
};

type Body = object | undefined;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Body;
  signal?: AbortSignal;
  keepalive?: boolean;
  /** Internal: the request is a retry after renewing the session. */
  retried?: boolean;
}

/** Routes that sign in or out themselves: a 401 from them is an answer, not an expired session. */
const SESSION_ROUTES = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout", "/api/auth/password-reset"];

let renewing: Promise<boolean> | null = null;

/**
 * Renew the access token with the refresh cookie (HttpOnly, sent by the browser). Resolves whether it
 * worked. Requests that fail at the same moment share one renewal.
 */
export function renewSession(): Promise<boolean> {
  renewing ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, { method: "POST", headers: { Accept: "application/json" } });
      if (!response.ok) return false;
      const body = (await response.json().catch(() => null)) as { token?: string } | null;
      if (!body?.token) return false;
      tokenStore.set(body.token);
      return true;
    } catch {
      return false;
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}

/** FastAPI returns `detail` as a string, or as a list of validation errors. */
function describeError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : ""))
        .filter(Boolean);
      if (messages.length) return messages.join("; ");
    }
  }
  return fallback;
}

/** The signed-in session's headers: the bearer token, and the organisation requests act on. */
function sessionHeaders(): { token: string | null; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const orgId = token ? orgStore.get() : null;
  if (orgId) headers["X-Org-Id"] = orgId;
  return { token, headers };
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the LaunchOps server. Check your connection and try again.");
  }
}

/**
 * The error for a failed response. A 401 on a signed-in request first renews the session once
 * ("retry": send the request again); if that doesn't work, the session ends and the app is told why.
 */
async function failure(response: Response, path: string, token: string | null, retried: boolean): Promise<ApiError | "retry"> {
  const payload: unknown = await response.json().catch(() => null);
  const message = describeError(payload, `Request failed (${response.status} ${response.statusText})`);
  if (response.status === 401 && token && !SESSION_ROUTES.some((route) => path.startsWith(route))) {
    // Access tokens last minutes; renew once and try again before ending the session
    if (!retried && (await renewSession())) return "retry";
    tokenStore.clear();
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: message }));
  }
  return new ApiError(response.status, message);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers } = sessionHeaders();
  headers.Accept = "application/json";
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await send(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    keepalive: options.keepalive,
  });

  if (!response.ok) {
    const error = await failure(response, path, token, Boolean(options.retried));
    if (error === "retry") return request<T>(path, { ...options, retried: true });
    throw error;
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Open a Server-Sent Events stream and resolve with its body once the server accepts. It carries the
 * same headers as request() (EventSource can't send them, so streams are read with fetch) and renews
 * an expired session the same way. Rejects with an ApiError when the server refuses, can't be reached,
 * or answers with something that isn't an event stream; aborting `signal` rejects with an AbortError.
 */
export async function openEventStream(path: string, signal: AbortSignal, retried = false): Promise<ReadableStream<Uint8Array>> {
  const { token, headers } = sessionHeaders();
  headers.Accept = "text/event-stream";
  const response = await send(path, { headers, signal });

  if (!response.ok) {
    const error = await failure(response, path, token, retried);
    if (error === "retry") return openEventStream(path, signal, true);
    throw error;
  }
  if (!response.body || !(response.headers.get("Content-Type") ?? "").startsWith("text/event-stream")) {
    // Not awaited: cancelling a body that was cloned along the way only settles once every copy is cancelled.
    void response.body?.cancel().catch(() => undefined);
    throw new ApiError(response.status, "The server didn't answer with a live update stream.");
  }
  return response.body;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
