import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { Template } from "@/lib/api/types";
import { UNDO_WINDOW_MS } from "@/lib/queries/hooks";
import { API, DATABASE_OUTAGE, id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

afterEach(() => vi.restoreAllMocks());

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: id("template"),
    name: "Intro email",
    type: "email",
    tags: ["outreach", "email"],
    content: "Keep it short and name one reason to reply.",
    source_product: "",
    created_at: "2026-09-10T09:00:00+00:00",
    ...overrides,
  };
}

const launchThread = () => makeTemplate({ name: "Launch thread", type: "social", tags: ["social"], content: "Day one of the launch." });

describe("Library templates", () => {
  it("shows the template you pick and filters the list by tag", async () => {
    const { user } = renderApp("/library", makeState({ templates: [makeTemplate(), launchThread()] }));
    const list = await screen.findByRole("region", { name: "Templates" });

    expect(await within(list).findByRole("button", { name: /^Intro email/, pressed: true })).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: /^Launch thread/ }));
    expect(await screen.findByRole("region", { name: "Launch thread" })).toHaveTextContent("Day one of the launch.");

    await user.selectOptions(within(list).getByLabelText("Filter by tag"), "email");
    expect(within(list).queryByRole("button", { name: /^Launch thread/ })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Intro email" })).toHaveTextContent("Keep it short and name one reason to reply.");

    await user.selectOptions(within(list).getByLabelText("Filter by tag"), "blog");
    expect(within(list).getByText("No templates")).toBeInTheDocument();
    expect(screen.getByText("Select a template")).toBeInTheDocument();
  });

  it("copies a template's content", async () => {
    const { user } = renderApp("/library", makeState({ templates: [makeTemplate()] }));
    const preview = await screen.findByRole("region", { name: "Intro email" });

    await user.click(within(preview).getByRole("button", { name: "Copy" }));

    expect(await within(preview).findByRole("button", { name: "Copied" })).toBeInTheDocument();
    // user-event installs its own clipboard, so read back what was written.
    expect(await navigator.clipboard.readText()).toBe("Keep it short and name one reason to reply.");
  });

  it("says so when the browser blocks copying", async () => {
    const { user } = renderApp("/library", makeState({ templates: [makeTemplate()] }));
    const preview = await screen.findByRole("region", { name: "Intro email" });
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("Write permission denied.", "NotAllowedError"));

    await user.click(within(preview).getByRole("button", { name: "Copy" }));

    expect(await screen.findByText("Couldn't copy")).toBeInTheDocument();
    expect(screen.getByText("Your browser blocked clipboard access.")).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("deletes a template, with Undo bringing it back before anything is sent", async () => {
    const state = makeState({ templates: [makeTemplate(), launchThread()] });
    const { user } = renderApp("/library", state);
    const list = await screen.findByRole("region", { name: "Templates" });
    const preview = await screen.findByRole("region", { name: "Intro email" });

    await user.click(within(preview).getByRole("button", { name: "Delete template" }));

    await waitFor(() => expect(within(list).queryByRole("button", { name: /^Intro email/ })).not.toBeInTheDocument());
    expect(await screen.findByRole("region", { name: "Launch thread" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await within(list).findByRole("button", { name: /^Intro email/ })).toBeInTheDocument();
    expect(requestsTo(state, "DELETE", "/api/templates")).toEqual([]);
  });

  it("brings a template back and says why when the delete fails", async () => {
    const state = makeState({ templates: [makeTemplate()] });
    const { user } = renderApp("/library", state);
    server.use(http.delete(`${API}/api/templates/:id`, () => HttpResponse.json({ detail: DATABASE_OUTAGE }, { status: 503 })));

    const preview = await screen.findByRole("region", { name: "Intro email" });
    await user.click(within(preview).getByRole("button", { name: "Delete template" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Intro email" })).not.toBeInTheDocument());

    expect(await screen.findByText("Template not deleted", {}, { timeout: UNDO_WINDOW_MS + 3000 })).toBeInTheDocument();
    expect(screen.getByText(DATABASE_OUTAGE)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Intro email" })).toBeInTheDocument();
  }, 20_000);

  it("keeps a new template open with the reason when it can't be saved", async () => {
    const { user } = renderApp("/library", makeState());
    server.use(http.post(`${API}/api/templates`, () => HttpResponse.json({ detail: DATABASE_OUTAGE }, { status: 503 })));

    await user.click(await screen.findByRole("button", { name: "New" }));
    const dialog = await screen.findByRole("dialog", { name: "New template" });
    await user.type(within(dialog).getByLabelText("Name"), "Intro email");
    await user.type(within(dialog).getByLabelText("Content"), "Keep it short.");
    await user.click(within(dialog).getByRole("button", { name: "Save template" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(DATABASE_OUTAGE);
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Intro email");
  });
});

describe("Library sections", () => {
  it("switches between templates and ideas, and captures an idea from there", async () => {
    const { user, router } = renderApp("/library", makeState({ projects: [makeProject()], templates: [makeTemplate()] }));

    await user.click(await screen.findByRole("button", { name: "Ideas · 0" }));
    expect(router.state.location.search).toBe("?tab=ideas");
    const ideas = await screen.findByRole("region", { name: "Ideas" });
    expect(within(ideas).getByText("No ideas yet")).toBeInTheDocument();

    await user.click(within(ideas).getByRole("button", { name: "Capture idea" }));
    expect(await screen.findByRole("dialog", { name: "Capture an idea" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Templates · 1" }));
    expect(router.state.location.search).toBe("");
    expect(await screen.findByRole("region", { name: "Intro email" })).toBeInTheDocument();
  });
});
