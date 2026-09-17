import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetPendingDeletes, isPendingDelete, scheduleDelete } from "./deferredDelete";

afterEach(() => {
  vi.useRealTimers();
  _resetPendingDeletes();
});

describe("scheduleDelete", () => {
  it("commits after the delay and stops hiding the item", async () => {
    vi.useFakeTimers();
    const commit = vi.fn(() => Promise.resolve());
    scheduleDelete("Idea:1", "1", commit, 5000);
    expect(isPendingDelete("1")).toBe(true);

    vi.advanceTimersByTime(4999);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledWith(false);
    expect(isPendingDelete("1")).toBe(false);
  });

  it("undo cancels the commit", () => {
    vi.useFakeTimers();
    const commit = vi.fn(() => Promise.resolve());
    const undo = scheduleDelete("Idea:2", "2", commit, 5000);
    expect(undo()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(commit).not.toHaveBeenCalled();
    expect(undo()).toBe(false);
  });

  it("sends pending deletes with keepalive when the page is closed", () => {
    vi.useFakeTimers();
    const commit = vi.fn(() => Promise.resolve());
    scheduleDelete("Email:3", "3", commit, 5000);
    window.dispatchEvent(new Event("pagehide"));
    expect(commit).toHaveBeenCalledWith(true);
    vi.advanceTimersByTime(10_000);
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
