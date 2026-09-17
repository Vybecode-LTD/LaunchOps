import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTheme } from "./useTheme";

const root = document.documentElement;

afterEach(() => {
  vi.restoreAllMocks();
  root.removeAttribute("data-theme");
});

describe("useTheme", () => {
  it("follows the system theme until someone picks one", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("system");
    expect(root).not.toHaveAttribute("data-theme");
  });

  it("applies a chosen theme to the page and remembers it in this browser", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current[1]("dark"));

    expect(result.current[0]).toBe("dark");
    expect(root).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("launchops_theme")).toBe("dark");
  });

  it("starts from the theme saved earlier", () => {
    localStorage.setItem("launchops_theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("light");
  });

  it("treats an unrecognised saved value as the system theme", () => {
    localStorage.setItem("launchops_theme", "sepia");
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("system");
  });

  it("going back to the system theme removes the override and the saved choice", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]("light"));

    act(() => result.current[1]("system"));

    expect(result.current[0]).toBe("system");
    expect(root).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem("launchops_theme")).toBeNull();
  });

  it("keeps every control showing the theme in step", () => {
    const menu = renderHook(() => useTheme());
    const settingsPage = renderHook(() => useTheme());

    act(() => menu.result.current[1]("dark"));

    expect(settingsPage.result.current[0]).toBe("dark");
  });

  it("still switches the page's theme when the browser blocks storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe("system");

    act(() => result.current[1]("dark"));

    expect(root).toHaveAttribute("data-theme", "dark");
  });
});
