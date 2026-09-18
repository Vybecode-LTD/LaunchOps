import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { id, API, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

// More operations behaviour; the basics (running a workflow, templates, a report and its failure) are in app.project.test.tsx.

const OFFLINE = "Can't reach the LaunchOps server. Check your connection and try again.";

/**
 * The row for an operation, found by its name: the innermost list item holding it. In the playbook,
 * operations sit inside stages that are list items themselves, so the first match is the stage.
 */
const operationRow = (name: string) => screen.getAllByRole("listitem").filter((item) => within(item).queryByText(name)).at(-1)!;

describe("Operations page", () => {
  it("stops using an idea when you choose not to", async () => {
    const project = makeProject();
    const idea = { id: id("capture"), text: "Reddit AMA for launch week", product_id: project.id, created_at: new Date().toISOString() };
    const state = makeState({ projects: [project], captures: [idea] });
    const { user, router } = renderApp(`/projects/${project.id}/operations?idea=${idea.id}`, state);

    await user.click(await screen.findByRole("button", { name: "Don't use it" }));

    expect(screen.queryByText(/pick an operation and it will be filled in as instructions/)).not.toBeInTheDocument();
    expect(router.state.location.search).toBe("");
    await user.click(within(operationRow("Competitor deep-dive")).getByRole("button", { name: "Run" }));
    expect(await screen.findByLabelText(/Instructions/)).toHaveValue("");
  });
});

describe("Running a workflow", () => {
  it("opens the started workflow in Review from its notification", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user, router } = renderApp(`/projects/${project.id}/operations?run=competitor`, state);

    await user.click(await screen.findByRole("button", { name: "Run competitor deep-dive" }));
    expect(await screen.findByText("Competitor deep-dive started")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "View" }));

    const task = state.queue[0]!;
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${project.id}/review/${task.id}`));
    expect(await screen.findByText("Working on it")).toBeInTheDocument();
  });

  it("keeps the run sheet open with the server's reason when a workflow can't start", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=competitor`, state);
    const busy = "You already have 3 operations running. Start another when one finishes.";
    server.use(http.post(`${API}/api/workflows/launch`, () => HttpResponse.json({ detail: busy }, { status: 429 })));

    await user.click(await screen.findByRole("button", { name: "Run competitor deep-dive" }));

    const sheet = screen.getByRole("dialog", { name: "Run competitor deep-dive" });
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(busy);
    expect(screen.queryByText("Competitor deep-dive started")).not.toBeInTheDocument();
  });
});

describe("Running a report", () => {
  it("bases a market analysis on the saved pricing strategy", async () => {
    const project = makeProject({
      pricing_result: { tiers: [{ name: "Creator", price: "$12/mo" }, { name: "Studio" }], generated_at: "2026-09-12T13:46:00+00:00" },
    });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=market_analysis`, state);

    expect(await screen.findByText("Uses the tiers from this project's pricing strategy: Creator ($12/mo), Studio (no price).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved pricing strategy" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Run market analysis" }));

    await waitFor(() => expect(requestsTo(state, "POST", "/api/market-analysis")[0]?.body).toEqual({ product_id: project.id, custom_pricing: "" }));
    expect(await screen.findByText("Market analysis saved")).toBeInTheDocument();
  });

  it("asks for pricing, or says it will be estimated, when no pricing strategy is saved", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=market_analysis`, state);

    expect(await screen.findByLabelText("Your pricing")).toBeRequired();
    expect(screen.getByRole("button", { name: "Run market analysis" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Estimate from research" }));
    expect(screen.getByText("No pricing strategy is saved for this project, so the model estimates pricing from its market research.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run market analysis" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Enter pricing" }));
    await user.type(screen.getByLabelText("Your pricing"), "Free tier; Pro $29/month");
    await user.click(screen.getByRole("button", { name: "Run market analysis" }));

    await waitFor(() =>
      expect(requestsTo(state, "POST", "/api/market-analysis")[0]?.body).toEqual({ product_id: project.id, custom_pricing: "Free tier; Pro $29/month" }),
    );
    expect(await screen.findByText("Market analysis saved")).toBeInTheDocument();
  });

  it("checks the page address before reading it for a press kit", async () => {
    const project = makeProject({ url: "" });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=press_kit`, state);

    const page = await screen.findByLabelText("Page to read");
    const run = screen.getByRole("button", { name: "Run press kit" });
    expect(run).toBeDisabled();

    await user.type(page, "dsp.vybecod.example");
    expect(page).toHaveAccessibleDescription("Enter a full address starting with https://");
    expect(run).toBeDisabled();

    await user.clear(page);
    await user.type(page, "https://dsp.vybecod.example/launch");
    expect(run).toBeEnabled();
    await user.click(run);

    await waitFor(() =>
      expect(requestsTo(state, "POST", "/api/presskit/generate")[0]?.body).toEqual({ product_id: project.id, url: "https://dsp.vybecod.example/launch" }),
    );
    expect(await screen.findByText("Press kit saved")).toBeInTheDocument();
  });

  it("writes a press release with the contacts you give", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=press_release`, state);

    const placeholders = "With no contact names, the release is written with placeholder contact names you'll need to replace.";
    expect(await screen.findByText(placeholders)).toBeInTheDocument();
    const sheet = screen.getByRole("dialog", { name: "Run press release" });
    // Each contact's fields share their names with the other contacts', so each contact is a named group.
    const media = within(within(sheet).getByRole("group", { name: "Media contact" }));
    const technical = within(within(sheet).getByRole("group", { name: "Technical contact" }));
    const sales = within(within(sheet).getByRole("group", { name: "Sales contact" }));
    expect(within(sheet).getAllByLabelText(/^Name/)).toHaveLength(3);
    await user.type(media.getByLabelText(/^Name/), "Dana Reyes");
    expect(screen.queryByText(placeholders)).not.toBeInTheDocument();
    await user.type(media.getByLabelText(/^Email/), "press@vybecod.example");
    await user.type(media.getByLabelText(/^Phone/), "+1 555 0100");
    expect(technical.queryByLabelText(/^Phone/)).not.toBeInTheDocument();
    await user.type(technical.getByLabelText(/^Name/), "Sam Okafor");
    await user.type(technical.getByLabelText(/^Email/), "sam@vybecod.example");
    await user.type(sales.getByLabelText(/^Name/), "Lee Park");
    await user.type(sales.getByLabelText(/^Email/), "sales@vybecod.example");
    await user.type(within(sheet).getByLabelText(/^Angle and details/), "Available on Windows and macOS");
    await user.click(within(sheet).getByRole("button", { name: "Run press release" }));

    await waitFor(() =>
      expect(requestsTo(state, "POST", "/api/press-release/generate")[0]?.body).toEqual({
        product_id: project.id,
        url: "https://dsp.vybecod.example",
        media_contact_name: "Dana Reyes",
        media_contact_email: "press@vybecod.example",
        media_contact_phone: "+1 555 0100",
        technical_contact_name: "Sam Okafor",
        technical_contact_email: "sam@vybecod.example",
        sales_contact_name: "Lee Park",
        sales_contact_email: "sales@vybecod.example",
        additional_notes: "Available on Windows and macOS",
      }),
    );
    expect(await screen.findByText("Press release saved")).toBeInTheDocument();
  });

  it("shows why a page couldn't be read for SEO metadata", async () => {
    const project = makeProject();
    const reason = "Could not analyze URL: We couldn't find that website. Check the address.";
    const state = makeState({ projects: [project], reportResponse: () => HttpResponse.json({ detail: reason }, { status: 400 }) });
    const { user } = renderApp(`/projects/${project.id}/operations?run=seo`, state);

    expect(await screen.findByLabelText("Page to read")).toHaveValue("https://dsp.vybecod.example");
    await user.click(screen.getByRole("button", { name: "Run SEO metadata" }));

    await waitFor(() => expect(requestsTo(state, "POST", "/api/seo/analyze")[0]?.body).toEqual({ product_id: project.id, url: "https://dsp.vybecod.example" }));
    expect(await screen.findByText("SEO metadata failed")).toBeInTheDocument();
    expect(await within(screen.getByRole("dialog", { name: "Run SEO metadata" })).findByRole("alert")).toHaveTextContent(reason);
  });

  it("opens the saved report from its notification", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user, router } = renderApp(`/projects/${project.id}/operations?run=pricing`, state);

    await user.click(await screen.findByRole("button", { name: "Run pricing strategy" }));
    expect(await screen.findByText("Pricing strategy saved")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Pricing strategy" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/projects/${project.id}/reports/pricing`);
  });

  it("warns before the page is closed while a report is still running", async () => {
    const project = makeProject();
    // The report's response is held back until the test releases it.
    const response: { release?: () => void } = {};
    const state = makeState({
      projects: [project],
      reportResponse: () =>
        new Promise<Response>((resolve) => {
          response.release = () => resolve(HttpResponse.json({ tiers: [{ name: "Pro", price: "$29/mo" }], generated_at: new Date().toISOString() }));
        }),
    });
    const { user } = renderApp(`/projects/${project.id}/operations?run=pricing`, state);
    /** Dispatches the event browsers send before closing a page; true when the page asks to stay. */
    const pageAsksToStay = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(pageAsksToStay()).toBe(false);

    await user.click(await screen.findByRole("button", { name: "Run pricing strategy" }));
    const sheet = screen.getByRole("dialog", { name: "Run pricing strategy" });
    expect(await within(sheet).findByRole("status")).toHaveTextContent(/Running/);
    expect(pageAsksToStay()).toBe(true);

    await waitFor(() => expect(response.release).toBeDefined());
    response.release!();
    expect(await screen.findByText("Pricing strategy saved")).toBeInTheDocument();
    expect(pageAsksToStay()).toBe(false);
  });
});

describe("Repurpose tool", () => {
  it("shows why content couldn't be repurposed", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=repurpose`, state);
    const reason = "The AI provider returned an error (HTTP 529). Try again in a few minutes.";
    server.use(http.post(`${API}/api/repurpose`, () => HttpResponse.json({ detail: reason }, { status: 502 })));

    await user.type(await screen.findByLabelText(/Content to repurpose/), "We launch Friday");
    await user.click(screen.getByRole("button", { name: "Repurpose" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(reason);
    expect(screen.queryByRole("button", { name: "Save as template" })).not.toBeInTheDocument();
  });

  it("says when a version can't be saved as a template", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=repurpose`, state);

    await user.type(await screen.findByLabelText(/Content to repurpose/), "We launch Friday");
    await user.click(screen.getByRole("button", { name: "Repurpose" }));
    const save = await screen.findByRole("button", { name: "Save as template" });
    server.use(http.post(`${API}/api/templates`, () => HttpResponse.error()));
    await user.click(save);

    expect(await screen.findByText("Template not saved")).toBeInTheDocument();
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
    expect(screen.queryByText("Saved to templates")).not.toBeInTheDocument();
  });
});
