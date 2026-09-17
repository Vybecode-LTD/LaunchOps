import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addDays, toDateKey } from "@/lib/domain/dates";
import { RESEARCH_SOURCES, id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";

const today = toDateKey(new Date());

describe("Project overview", () => {
  it("lists what's missing as next steps, linked to where it's fixed", async () => {
    const project = makeProject({ url: "", launch_date: null, keywords: [] });
    renderApp(`/projects/${project.id}`, makeState({ projects: [project] }));

    const steps = await screen.findByRole("region", { name: "Next steps" });
    expect(within(steps).getByRole("link", { name: "Set a launch date" })).toHaveAttribute("href", `/projects/${project.id}/settings`);
    expect(within(steps).getByRole("link", { name: "Add the website" })).toBeInTheDocument();
    expect(within(steps).getByRole("link", { name: "Generate the market analysis" })).toHaveAttribute(
      "href",
      `/projects/${project.id}/operations?run=market_analysis`,
    );
  });

  it("changes status and launch date in place", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}`, state);

    const launch = await screen.findByRole("region", { name: "Launch" });
    await user.selectOptions(within(launch).getByLabelText("Status"), "launched");
    await waitFor(() => expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body).toEqual({ status: "launched" }));

    const date = within(launch).getByLabelText("Launch date");
    fireEvent.change(date, { target: { value: addDays(today, 30) } });
    fireEvent.blur(date);
    await waitFor(() => expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[1]?.body).toEqual({ launch_date: addDays(today, 30) }));
    expect(await screen.findByText(/Launch date set to/)).toBeInTheDocument();
  });

  it("shows the T-minus clock and readiness breakdown", async () => {
    const project = makeProject({ launch_date: addDays(today, 12) });
    const { user } = renderApp(`/projects/${project.id}`, makeState({ projects: [project] }));

    expect(await screen.findByText("12 days until launch", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Launch readiness \d+ of 100/ }));
    expect(await screen.findByText(/Score = 50 × plan items done/)).toBeInTheDocument();
  });
});

describe("Reports", () => {
  const pricing = { tiers: [{ name: "Creator", price: "$12/mo", recommended: true }], generated_at: "2026-09-12T13:46:00+00:00" };

  it("lists reports with their state", async () => {
    const project = makeProject({ pricing_result: pricing });
    renderApp(`/projects/${project.id}/reports`, makeState({ projects: [project] }));

    expect(await screen.findByRole("heading", { name: "Pricing strategy" })).toBeInTheDocument();
    expect(screen.getAllByText("Not generated yet")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Open pricing strategy" })).toHaveAttribute("href", `/projects/${project.id}/reports/pricing`);
    expect(screen.getByRole("link", { name: "Generate SEO metadata" })).toHaveAttribute("href", `/projects/${project.id}/operations?run=seo`);
  });

  it("opens a report document and exports it as Markdown", async () => {
    const project = makeProject({ pricing_result: pricing });
    const createObjectURL = vi.fn(() => "blob:report");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const { user } = renderApp(`/projects/${project.id}/reports/pricing`, makeState({ projects: [project] }));

    expect(await screen.findByRole("heading", { level: 1, name: "Pricing strategy" })).toBeInTheDocument();
    expect(screen.getByText(/Generated Sep 12, 2026/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Export/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy as Markdown" }));
    // user-event installs its own clipboard, so read back what was written.
    await waitFor(async () => expect(await navigator.clipboard.readText()).toContain("# Pricing strategy — VybeCode DSP"));

    await user.click(screen.getByRole("button", { name: /Export/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Download Markdown" }));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("lists the pages a generated report's research relied on, in its contents and its export", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=pricing`, state);

    await user.click(await screen.findByRole("button", { name: "Run pricing strategy" }));
    await user.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Pricing strategy" })).toBeInTheDocument();
    const contents = screen.getByRole("navigation", { name: "On this page" });
    expect(within(contents).getAllByRole("link").map((link) => link.textContent)).toEqual(["Recommended tiers", "Sources"]);
    expect(within(contents).getByRole("link", { name: "Sources" })).toHaveAttribute("href", "#sources");
    const sources = screen.getByRole("region", { name: /^Sources/ });
    expect(within(sources).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(RESEARCH_SOURCES.map((source) => source.url));

    await user.click(screen.getByRole("button", { name: /Export/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy as Markdown" }));
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toContain(
        "## Sources\n\n1. PatchForge pricing and plans — https://patchforge.example/pricing (updated September 2, 2026)\n",
      ),
    );
  });

  it("offers to generate a report that doesn't exist yet", async () => {
    const project = makeProject();
    renderApp(`/projects/${project.id}/reports/seo`, makeState({ projects: [project] }));
    expect(await screen.findByText("No SEO metadata yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Generate SEO metadata" })).toHaveAttribute("href", `/projects/${project.id}/operations?run=seo`);
  });
});

describe("Repurpose tool", () => {
  it("rewrites for the chosen channels and saves one as a template", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=repurpose`, state);

    await user.type(await screen.findByLabelText(/Content to repurpose/), "We launch Friday");
    await user.click(screen.getByLabelText("Reddit"));
    await user.click(screen.getByRole("button", { name: "Repurpose" }));

    await waitFor(() => expect(requestsTo(state, "POST", "/api/repurpose")[0]?.body).toEqual({ product_id: project.id, content: "We launch Friday", platforms: ["twitter", "reddit"] }));
    expect(await screen.findByText("twitter: We launch Friday")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in X" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Save as template" })[0]!);
    await waitFor(() => expect(requestsTo(state, "POST", "/api/templates")[0]?.body).toMatchObject({ type: "social", tags: ["social", "content"] }));
  });
});

describe("Deleting a project", () => {
  it("requires typing the name, then returns to the portfolio", async () => {
    const project = makeProject({ name: "Tessera Health" });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    await user.click(await screen.findByRole("button", { name: "Delete Tessera Health…" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete project" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type Tessera Health to confirm"), "Tessera Health");
    await user.click(confirm);

    await waitFor(() => expect(requestsTo(state, "DELETE", `/api/products/${project.id}`)).toHaveLength(1));
    expect(await screen.findByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
  });
});

describe("Shell", () => {
  it("jumps to a project from the command palette", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const { user } = renderApp("/portfolio", makeState({ projects: [project] }));

    await screen.findByRole("heading", { level: 1, name: "Portfolio" });
    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByPlaceholderText(/Search projects, pages and operations/), "Fieldnote");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("heading", { level: 1, name: /Fieldnote/ })).toBeInTheDocument();
  });

  it("shows running workflows with any retry that's waiting, and flags ones that may be stuck", async () => {
    const project = makeProject();
    const running = { id: id("queue"), product_id: project.id, workflow_id: "blog", status: "running" as const, content: {}, preview: "Running blog...", input_params: "", notes: "", created_at: new Date().toISOString() };
    const retrying = { ...running, id: id("queue"), workflow_id: "trend", preview: "Trying again in 2 minutes: The AI provider returned an error (HTTP 529)." };
    const stalled = { ...running, id: id("queue"), workflow_id: "reddit", created_at: new Date(Date.now() - 75 * 60_000).toISOString() };
    const { user } = renderApp("/portfolio", makeState({ projects: [project], queue: [running, retrying, stalled] }));

    await user.click(await screen.findByRole("button", { name: "2 running" }));
    const popover = await screen.findByRole("dialog", { name: "Operations in progress" });
    expect(within(popover).getByText(`${project.name} · result goes to Review`)).toBeInTheDocument();
    expect(within(popover).getByText(`${project.name} · Trying again in 2 minutes: The AI provider returned an error (HTTP 529).`)).toBeInTheDocument();
    expect(within(popover).getByText("May be stuck")).toBeInTheDocument();
    expect(within(popover).getByRole("link", { name: "Reddit communities" })).toBeInTheDocument();
    expect(within(popover).getByText(`${project.name} · running over 60 min. Open it to cancel it and run it again.`)).toBeInTheDocument();
  });

  it("signs out from the account menu", async () => {
    const { user } = renderApp("/portfolio", makeState());
    await user.click(await screen.findByRole("button", { name: /Jordan Avery/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(localStorage.getItem("launchops_token")).toBeNull();
  });
});
