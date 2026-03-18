/**
 * API helper for VybeCod.ing Launch Ops.
 *
 * All backend calls go through this module.
 * In development, Vite proxies /api to localhost:8000.
 * In production, set VITE_API_BASE to your Railway backend URL.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  };
  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API Error ${res.status}`);
  }
  return res.json();
}

// ─── Products ───
export const products = {
  list: () => request("/api/products"),
  get: (id) => request(`/api/products/${id}`),
  create: (data) => request("/api/products", { method: "POST", body: data }),
  update: (id, data) => request(`/api/products/${id}`, { method: "PATCH", body: data }),
  delete: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
  updateChecklist: (id, checklist) =>
    request(`/api/products/${id}/checklist`, { method: "PATCH", body: checklist }),
};

// ─── Workflows ───
export const workflows = {
  launch: (data) => request("/api/workflows/launch", { method: "POST", body: data }),
};

// ─── Press Kit ───
export const pressKit = {
  generate: (data) => request("/api/presskit/generate", { method: "POST", body: data }),
};

// ─── SEO ───
export const seo = {
  analyze: (data) => request("/api/seo/analyze", { method: "POST", body: data }),
};

// ─── Repurpose ───
export const repurpose = {
  create: (data) => request("/api/repurpose", { method: "POST", body: data }),
};

// ─── Pricing ───
export const pricing = {
  analyze: (data) => request("/api/pricing/analyze", { method: "POST", body: data }),
};

// ─── Queue ───
export const queue = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/queue${qs ? `?${qs}` : ""}`);
  },
  get: (id) => request(`/api/queue/${id}`),
  update: (id, data) => request(`/api/queue/${id}`, { method: "PATCH", body: data }),
  delete: (id) => request(`/api/queue/${id}`, { method: "DELETE" }),
};

// ─── Templates ───
export const templates = {
  list: (tags) => request(`/api/templates${tags ? `?tags=${tags}` : ""}`),
  forWorkflow: (workflowId) => request(`/api/templates/for-workflow/${workflowId}`),
  create: (data) => request("/api/templates", { method: "POST", body: data }),
  delete: (id) => request(`/api/templates/${id}`, { method: "DELETE" }),
};

// ─── Calendar ───
export const calendar = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/calendar${qs ? `?${qs}` : ""}`);
  },
  create: (data) => request("/api/calendar", { method: "POST", body: data }),
  delete: (id) => request(`/api/calendar/${id}`, { method: "DELETE" }),
};

// ─── Captures ───
export const captures = {
  list: (productId) =>
    request(`/api/captures${productId ? `?product_id=${productId}` : ""}`),
  create: (data) => request("/api/captures", { method: "POST", body: data }),
  delete: (id) => request(`/api/captures/${id}`, { method: "DELETE" }),
};

// ─── Settings ───
export const settings = {
  get: () => request("/api/settings"),
  update: (data) => request("/api/settings", { method: "PUT", body: data }),
};
