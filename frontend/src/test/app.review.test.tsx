import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { QueueItem } from "@/lib/api/types";
import { API, RESEARCH_SOURCES, id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

afterEach(() => {
  vi.restoreAllMocks();
});

/** The result list's links, and the one that is open. */
const results = () => within(screen.getByRole("list", { name: "Results" }));
const openResult = () => results().getByRole("link", { current: true });

function queueItem(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: id("queue"),
    product_id: "",
    workflow_id: "social_posts",
    status: "pending",
    content: {},
    preview: "",
    input_params: "",
    notes: "",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("Review", () => {
  it("opens the first result and explains what approving an outreach result does", async () => {
    const project = makeProject();
    const item = queueItem({
      product_id: project.id,
      workflow_id: "cold_outreach",
      content: { emails: [{ subject: "A plugin you could build", body: "Hi Dana", target_type: "Journalist" }] },
      preview: "Drafted 1 outreach emails",
    });
    const state = makeState({ projects: [project], queue: [item] });
    const { user } = renderApp(`/projects/${project.id}/review`, state);

    expect(await screen.findByText("A plugin you could build")).toBeInTheDocument();
    expect(screen.getByText(/Approving copies any email addresses in this result to the Outbox as drafts/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(requestsTo(state, "PATCH", `/api/queue/${item.id}`)).toEqual([
        { method: "PATCH", path: `/api/queue/${item.id}`, body: { status: "approved", notes: "" } },
      ]),
    );
    expect(await screen.findByText(/Approved — any email addresses were added to the Outbox as drafts/)).toBeInTheDocument();
    expect(state.requests.some((r) => r.path.includes("/send"))).toBe(false);
  });

  it("brings contacts from an approved partnership scan into the Outbox as drafts", async () => {
    const project = makeProject();
    const item = queueItem({
      product_id: project.id,
      workflow_id: "partnerships",
      content: { partnerships: [{ name: "Waveline", type: "Integration", contact: "partners@waveline.example", rationale: "Shared users" }] },
    });
    const state = makeState({ projects: [project], queue: [item] });
    const { user } = renderApp(`/projects/${project.id}/review/${item.id}`, state);

    await user.click(await screen.findByRole("button", { name: "Approve" }));

    // The Outbox refreshes shortly after approval, once the drafts exist.
    expect(await screen.findByRole("link", { name: "Outbox 1 unsent" }, { timeout: 4000 })).toBeInTheDocument();
    expect(state.emails).toEqual([
      expect.objectContaining({ recipient_email: "partners@waveline.example", source_queue_id: item.id, status: "pending", product_id: project.id }),
    ]);
    expect(state.requests.some((r) => r.path.includes("/send"))).toBe(false);
  });

  it("offers to run a failed operation again with the same instructions", async () => {
    const project = makeProject();
    const failed = queueItem({
      product_id: project.id,
      workflow_id: "partnerships",
      status: "failed",
      content: { error: "Claude API error 529: overloaded" },
      input_params: "Focus on DAW makers",
    });
    const state = makeState({ projects: [project], queue: [failed] });
    const { user } = renderApp(`/projects/${project.id}/review/${failed.id}?status=failed`, state);

    expect(await screen.findByText("This operation failed: Claude API error 529: overloaded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run again" }));

    await waitFor(() =>
      expect(requestsTo(state, "POST", "/api/workflows/launch")[0]?.body).toEqual({
        product_id: project.id,
        workflow_id: "partnerships",
        instructions: "Focus on DAW makers",
      }),
    );
  });

  it("ends a research result with the pages it relied on, and exports them with their addresses", async () => {
    const project = makeProject({ name: "Halcyon Studio" });
    const item = queueItem({
      product_id: project.id,
      workflow_id: "competitor",
      // As stored: JSONB puts the shorter "sources" key first.
      content: { sources: RESEARCH_SOURCES, competitors: [{ name: "PatchForge", threat_level: 7 }] },
    });
    const { user } = renderApp(`/review/${item.id}`, makeState({ projects: [project], queue: [item] }));

    const sources = await screen.findByRole("region", { name: /^Sources/ });
    const links = within(sources).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(RESEARCH_SOURCES.map((source) => [source.title, source.url]));
    expect(within(sources).getByText("patchforge.example · Updated September 2, 2026")).toBeInTheDocument();
    expect(within(sources).getByText("knobworks.example")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Export/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy as plain text" }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toMatch(/\n\nSOURCES\n {2}1\. PatchForge pricing and plans\n {5}https:\/\/patchforge\.example\/pricing\n/));
    expect(await navigator.clipboard.readText()).toMatch(/ {2}3\. KnobWorks: build effects without code\n {5}https:\/\/knobworks\.example\/$/);
  });

  it("renders competitor results as a ranked table", async () => {
    const project = makeProject();
    const item = queueItem({
      product_id: project.id,
      workflow_id: "competitor",
      content: {
        competitors: [
          { name: "KnobWorks", threat_level: 3 },
          { name: "PatchForge", threat_level: "7/10", url: "https://patchforge.example" },
        ],
      },
    });
    renderApp(`/projects/${project.id}/review/${item.id}`, makeState({ projects: [project], queue: [item] }));

    const threats = await screen.findAllByRole("img", { name: /Threat level/ });
    expect(threats[0]).toHaveAccessibleName("Threat level 7 of 10");
    expect(screen.getAllByText("PatchForge").length).toBeGreaterThan(0);
  });
});

describe("Review across projects", () => {
  it("filters every project's results by status and by project", async () => {
    const dsp = makeProject({ name: "VybeCode DSP" });
    const orbit = makeProject({ name: "Orbit Payroll" });
    const posts = queueItem({ product_id: dsp.id, workflow_id: "social_posts", preview: "Drafted 6 posts" });
    const ads = queueItem({ product_id: orbit.id, workflow_id: "ad_copy", preview: "Drafted 4 ad variants" });
    const blog = queueItem({ product_id: orbit.id, workflow_id: "blog", status: "approved", notes: "Used in the launch email" });
    const state = makeState({ projects: [dsp, orbit], queue: [posts, ads, blog] });
    const { user } = renderApp("/review", state);

    expect(await screen.findByRole("heading", { level: 1, name: "Review" })).toBeInTheDocument();
    // Wide screens open the first result that needs review.
    await waitFor(() => expect(openResult()).toHaveTextContent("Social posts"));
    expect(openResult()).toHaveTextContent("Drafted 6 posts");
    expect(openResult()).toHaveTextContent("VybeCode DSP · just now");
    expect(results().getAllByRole("link")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Approved · 1" }));
    await waitFor(() => expect(results().getAllByRole("link")).toHaveLength(1));
    await user.click(results().getByRole("link", { name: /Blog post draft/ }));
    const detail = await screen.findByRole("heading", { level: 2, name: /^Blog post draft/ });
    expect(detail).toHaveTextContent("Approved");
    expect(screen.getByText("Note: Used in the launch email")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Orbit Payroll" })).toHaveAttribute("href", `/projects/${orbit.id}`);

    await user.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(results().getAllByRole("link")).toHaveLength(3));

    await user.selectOptions(screen.getByLabelText("Filter by project"), "Orbit Payroll");
    await waitFor(() => expect(requestsTo(state, "GET", `/api/queue?product_id=${orbit.id}`)).toHaveLength(1));
    await waitFor(() => expect(results().getAllByRole("link")).toHaveLength(2));
    expect(results().queryByRole("link", { name: /Social posts/ })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by project"), "All projects");
    await waitFor(() => expect(results().getAllByRole("link")).toHaveLength(3));

    await user.click(screen.getByRole("button", { name: "Needs review · 2" }));
    await waitFor(() => expect(results().getAllByRole("link")).toHaveLength(2));
  });

  it("says when a status has no results", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project], queue: [queueItem({ product_id: project.id })] });
    const { user } = renderApp("/review?status=failed", state);

    expect(await screen.findByText("No results here")).toBeInTheDocument();
    expect(screen.getByText("Try another status filter.")).toBeInTheDocument();
    expect(screen.getByText("Results you select open here.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Needs review · 1" }));
    await waitFor(() => expect(openResult()).toHaveTextContent("Social posts"));
  });
});

describe("Review keyboard", () => {
  it("moves through the list with J and K, but not while typing or with a modifier key", async () => {
    const project = makeProject();
    const queue = ["social_posts", "blog", "ad_copy"].map((workflow_id) => queueItem({ product_id: project.id, workflow_id }));
    const state = makeState({ projects: [project], queue });
    const { user } = renderApp(`/projects/${project.id}/review`, state);

    await waitFor(() => expect(openResult()).toHaveTextContent("Social posts"));
    await user.keyboard("j");
    await waitFor(() => expect(openResult()).toHaveTextContent("Blog post draft"));
    expect(screen.getByRole("heading", { level: 2, name: /^Blog post draft/ })).toBeInTheDocument();
    await user.keyboard("j");
    await waitFor(() => expect(openResult()).toHaveTextContent("Ad copy variants"));
    await user.keyboard("j");
    await user.keyboard("k");
    // J on the last result stays there, so K goes back one.
    await waitFor(() => expect(openResult()).toHaveTextContent("Blog post draft"));

    await user.keyboard("{Control>}j{/Control}");
    await user.click(screen.getAllByRole("button", { name: "Capture idea" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Capture an idea" });
    await user.type(within(dialog).getByLabelText("Idea"), "join the jam");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.keyboard("k");
    // Neither Ctrl+J nor typing moved the selection: K goes from the second result to the first.
    await waitFor(() => expect(openResult()).toHaveTextContent("Social posts"));
  });

  it("on a narrow screen, waits for a choice and opens the first result with J", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const project = makeProject();
    const queue = ["social_posts", "blog"].map((workflow_id) => queueItem({ product_id: project.id, workflow_id }));
    const { user } = renderApp(`/projects/${project.id}/review`, makeState({ projects: [project], queue }));

    expect(await screen.findByText("Choose a result from the list, or press J to open the first one.")).toBeInTheDocument();
    expect(results().queryByRole("link", { current: true })).not.toBeInTheDocument();

    await user.keyboard("j");
    await waitFor(() => expect(openResult()).toHaveTextContent("Social posts"));
  });
});

describe("Reviewing a result", () => {
  it("rejects a result, moves it back to review and approves it", async () => {
    const project = makeProject();
    const item = queueItem({ product_id: project.id, workflow_id: "social_posts", content: { posts: [{ platform: "twitter", content: "Launch day" }] } });
    const state = makeState({ projects: [project], queue: [item] });
    const { user } = renderApp(`/projects/${project.id}/review/${item.id}`, state);
    const reviews = () => requestsTo(state, "PATCH", `/api/queue/${item.id}`).map((r) => r.body);

    await user.click(await screen.findByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Result rejected")).toBeInTheDocument();
    expect(reviews()).toEqual([{ status: "rejected", notes: "" }]);
    expect(screen.getByRole("heading", { level: 2, name: /^Social posts/ })).toHaveTextContent("Rejected");
    expect(screen.getByText("Nothing to review")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move back to review" }));
    expect(await screen.findByText("Moved back to Needs review")).toBeInTheDocument();
    expect(reviews()).toEqual([
      { status: "rejected", notes: "" },
      { status: "pending", notes: "" },
    ]);

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    // Social posts have no email addresses to draft, so approving says only that.
    expect(await screen.findByText("Result approved")).toBeInTheDocument();
    expect(reviews()).toHaveLength(3);
  });

  it("says why an action failed and leaves the result waiting for review", async () => {
    const project = makeProject();
    const item = queueItem({ product_id: project.id, workflow_id: "blog", content: { title: "Why producers build their own plugins" } });
    const state = makeState({ projects: [project], queue: [item] });
    const { user } = renderApp(`/projects/${project.id}/review/${item.id}`, state);
    await screen.findByRole("button", { name: "Approve" });
    // Deleted meanwhile, e.g. in another tab.
    server.use(http.patch(`${API}/api/queue/:id`, () => HttpResponse.json({ detail: "Queue item not found" }, { status: 404 })));

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("Approve failed")).toBeInTheDocument();
    expect(screen.getByText("Queue item not found")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /^Blog post draft/ })).toHaveTextContent("Needs review");
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("explains a running operation, and offers to cancel or delete one that may be stuck", async () => {
    const project = makeProject();
    const running = queueItem({ product_id: project.id, workflow_id: "competitor", status: "running", preview: "Running competitor..." });
    // Retries can keep a healthy operation running for up to about 48 minutes.
    const retried = queueItem({ product_id: project.id, workflow_id: "trend", status: "running", created_at: new Date(Date.now() - 50 * 60_000).toISOString() });
    const stalled = queueItem({ product_id: project.id, workflow_id: "blog", status: "running", created_at: new Date(Date.now() - 75 * 60_000).toISOString() });
    const state = makeState({ projects: [project], queue: [running, retried, stalled] });
    const { user } = renderApp(`/projects/${project.id}/review/${running.id}?status=running`, state);

    expect(await screen.findByText("Working on it")).toBeInTheDocument();
    expect(screen.getByText(/This operation uses live web research, which can take a few minutes\./)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /^Competitor deep-dive/ })).toHaveTextContent("Running");
    expect(screen.getByRole("button", { name: "Cancel operation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete result" })).not.toBeInTheDocument();
    expect(results().queryByText("Running competitor...")).not.toBeInTheDocument();
    expect(results().getByRole("link", { name: /Trend report/ })).toHaveTextContent("Running");

    const stuck = results().getByRole("link", { name: /Blog post draft/ });
    expect(stuck).toHaveTextContent("Stalled");
    await user.click(stuck);
    expect(await screen.findByText("This operation may be stuck")).toBeInTheDocument();
    expect(screen.getByText(/It has been running for 75 minutes\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel operation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run again" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete result" })).toBeInTheDocument();
  });

  it("deletes a result after a moment, and brings it back on Undo", async () => {
    const project = makeProject();
    const posts = queueItem({ product_id: project.id, workflow_id: "social_posts" });
    const blog = queueItem({ product_id: project.id, workflow_id: "blog" });
    const state = makeState({ projects: [project], queue: [posts, blog] });
    const { user } = renderApp(`/projects/${project.id}/review/${posts.id}`, state);

    await user.click(await screen.findByRole("button", { name: "Delete result" }));

    // The next result opens in its place.
    await waitFor(() => expect(openResult()).toHaveTextContent("Blog post draft"));
    expect(results().getAllByRole("link")).toHaveLength(1);
    expect(requestsTo(state, "DELETE", "/api/queue")).toEqual([]);

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(results().getAllByRole("link")).toHaveLength(2));
    expect(requestsTo(state, "DELETE", "/api/queue")).toEqual([]);
  });
});

describe("Exporting a result", () => {
  const blogResult = { title: "Why producers build their own plugins", full_content: "Body text", word_count: 900 };

  async function openBlogResult(overrides: Partial<QueueItem> = {}) {
    const project = makeProject({ name: "Halcyon Studio" });
    const item = queueItem({ product_id: project.id, workflow_id: "blog", content: blogResult, ...overrides });
    const state = makeState({ projects: [project], queue: [item] });
    const app = renderApp(`/projects/${project.id}/review/${item.id}`, state);
    const choose = async (action: string) => {
      await app.user.click(await screen.findByRole("button", { name: /Export/ }));
      await app.user.click(await screen.findByRole("menuitem", { name: action }));
    };
    return { ...app, state, choose };
  }

  it("copies a result as plain text, Markdown or a prompt for an AI assistant", async () => {
    const { choose } = await openBlogResult();

    await choose("Copy as plain text");
    expect(await screen.findByText("Text copied")).toBeInTheDocument();
    // user-event installs its own clipboard, so read back what was written.
    expect(await navigator.clipboard.readText()).toBe("TITLE: Why producers build their own plugins\nFULL CONTENT: Body text\nWORD COUNT: 900");

    await choose("Copy as Markdown");
    expect(await screen.findByText("Markdown copied")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(
      "# Blog post draft — Halcyon Studio\n\n## Title\n\nWhy producers build their own plugins\n\n## Full content\n\nBody text\n\n## Word count\n\n900\n",
    );

    await choose("Copy as AI assistant prompt");
    expect(await screen.findByText("Prompt copied")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toMatch(/^Below are blog post draft results for Halcyon Studio, produced by LaunchOps and approved for use\./);
  });

  it("says so when the browser blocks the clipboard", async () => {
    const { choose } = await openBlogResult();
    await screen.findByRole("button", { name: /Export/ });
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new DOMException("Write permission denied.", "NotAllowedError"));

    await choose("Copy as Markdown");

    expect(await screen.findByText("Couldn't copy")).toBeInTheDocument();
    expect(screen.queryByText("Markdown copied")).not.toBeInTheDocument();
  });

  it("downloads a result as a Markdown file named after the project and operation", async () => {
    const { choose } = await openBlogResult();
    const { createObjectURL, revokeObjectURL } = URL;
    const files: Array<{ name: string; type: string; text: Promise<string> }> = [];
    let blob: Blob | undefined;
    // jsdom has no object URLs or downloads.
    Object.assign(URL, {
      createObjectURL: (value: Blob) => {
        blob = value;
        return "blob:launchops/review-export";
      },
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      if (blob) files.push({ name: this.download, type: blob.type, text: blob.text() });
    });

    try {
      await choose("Download Markdown");
      await waitFor(() => expect(files).toHaveLength(1));
      expect(files[0]).toMatchObject({ name: "halcyon-studio-blog.md", type: "text/markdown;charset=utf-8" });
      expect(await files[0]!.text).toMatch(/^# Blog post draft — Halcyon Studio\n\n## Title\n/);
    } finally {
      Object.assign(URL, { createObjectURL, revokeObjectURL });
    }
  });

  it("saves a result as a template tagged for its operation", async () => {
    const { choose, state } = await openBlogResult();

    await choose("Save as template");

    expect(await screen.findByText("Saved to templates")).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/templates").map((r) => r.body)).toEqual([
      {
        name: "Blog post draft — Halcyon Studio",
        type: "content",
        tags: ["content", "blog"],
        content: "# Blog post draft — Halcyon Studio\n\n## Title\n\nWhy producers build their own plugins\n\n## Full content\n\nBody text\n\n## Word count\n\n900\n",
        source_product: "Halcyon Studio",
      },
    ]);
  });

  it("saves a retired operation's result as a content template tagged with its id", async () => {
    const { choose, state } = await openBlogResult({ workflow_id: "press_targets", content: { targets: [{ name: "Synth Weekly" }] } });

    await choose("Save as template");

    expect(await screen.findByText("Saved to templates")).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/templates")[0]?.body).toMatchObject({
      name: "Press targets (retired) — Halcyon Studio",
      type: "content",
      tags: ["press_targets"],
    });
  });
});
