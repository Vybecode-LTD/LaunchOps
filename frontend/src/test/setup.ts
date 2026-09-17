import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import { server } from "./server";
import { liveUpdates } from "./fakeApi";
import { _resetPendingDeletes } from "@/lib/hooks/deferredDelete";

// The first lookup in a file waits for a lazy route to be transformed and loaded, which took
// up to 7 s on a busy Windows machine (2026-09-16). Allow for that on slow machines and CI.
configure({ asyncUtilTimeout: 10_000 });

// jsdom gaps that Radix, cmdk and the app touch.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    // Tests render the desktop layout.
    matches: query.includes("min-width"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);
Element.prototype.releasePointerCapture ??= vi.fn();

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: vi.fn(() => Promise.resolve()) },
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  // Unmounting stops the app's live updates; end any stream still open so nothing waits on it.
  liveUpdates.end();
  server.resetHandlers();
  _resetPendingDeletes();
  localStorage.clear();
});

afterAll(() => server.close());
