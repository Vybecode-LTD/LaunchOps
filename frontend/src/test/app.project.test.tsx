import { describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw";
import type { Brand } from "@/lib/api/types";
import { id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";

describe("Launch plan", () => {
  it("shows a tick at once and keeps it while the full project is still loading", async () => {
    const project = makeProject({ checklist: {} });
    const state = makeState({ projects: [project], latency: { projectDetail: 2000, checklistSave: 1500 } });
    // Arriving from the portfolio: the project list is cached, so the plan renders from it
    // while the full project is still on its way.
    const { user, router } = renderApp("/portfolio", state);
    await screen.findByRole("table");
    await act(() => router.navigate(`/projects/${project.id}/plan`));

    const beta = await screen.findByLabelText("Beta testers recruited", {}, { timeout: 600 });
    await user.click(beta);
    // Well before the save (1.5 s) or the full project (2 s) could come back.
    await waitFor(() => expect(beta).toBeChecked(), { timeout: 600 });

    await user.click(screen.getByLabelText("SEO keywords researched"));
    await waitFor(
      () =>
        expect(requestsTo(state, "PATCH", `/api/products/${project.id}/checklist`).map((r) => r.body)).toEqual([
          { "Pre-Launch_5": true },
          { "Pre-Launch_5": true, "Pre-Launch_9": true },
        ]),
      { timeout: 6000 },
    );
    expect(screen.getByLabelText("Beta testers recruited")).toBeChecked();
  });

  it("saves the whole checklist when an item is ticked", async () => {
    const project = makeProject({ checklist: { "Pre-Launch_0": true } });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/plan`, state);

    await user.click(await screen.findByLabelText("Beta testers recruited"));

    await waitFor(() =>
      expect(requestsTo(state, "PATCH", `/api/products/${project.id}/checklist`)[0]?.body).toEqual({
        "Pre-Launch_0": true,
        "Pre-Launch_5": true,
      }),
    );
  });

  it("removes a custom item without moving its tick to the next one", async () => {
    const project = makeProject({
      checklist: { "_custom_Pre-Launch": ["Record demo", "Brief testers"], "Pre-Launch_15": true },
    });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/plan`, state);

    await user.click(await screen.findByRole("button", { name: 'Remove "Record demo"' }));

    await waitFor(() => {
      const body = requestsTo(state, "PATCH", `/api/products/${project.id}/checklist`)[0]?.body as Record<string, unknown>;
      expect(body["_custom_Pre-Launch"]).toEqual(["Brief testers"]);
      expect(body["Pre-Launch_15"]).toBeUndefined();
    });
  });
});

describe("Project settings", () => {
  const brand: Brand = {
    id: "brand-1",
    name: "VybeCod.ing Ltd",
    tagline: "",
    tone: "creative",
    keywords: [],
    avoid: [],
    elevator: "",
    company_name: "",
    industry: "Music technology",
    location: "",
    founded: "",
    founder_name: "",
    founder_title: "",
    phone: "",
    email: "",
    company_size: "",
    boilerplate: "",
    logo_url: "",
    created_at: "",
    updated_at: "",
  };

  it("assigns a company profile", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project], brands: [brand] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    const company = await screen.findByRole("region", { name: "Company" });
    await within(company).findByRole("option", { name: "VybeCod.ing Ltd (Music technology)" });
    await user.selectOptions(within(company).getByLabelText("Company profile"), "brand-1");
    expect(within(company).getByText(/Operations for this project use/)).toBeInTheDocument();
    await user.click(within(company).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body).toMatchObject({ brand_id: "brand-1" }));
  });

  it("never sends a blank password, so the saved one is kept", async () => {
    const project = makeProject({ email_settings: { smtp_host: "smtp.old.invalid", smtp_user: "u" } });
    const state = makeState({ projects: [project], smtpPasswords: { [project.id]: "saved" } });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    const email = await screen.findByRole("region", { name: "Email server" });
    expect(within(email).getByText("A password is saved. Leave blank to keep it.")).toBeInTheDocument();
    const host = within(email).getByLabelText("SMTP host");
    await user.clear(host);
    await user.type(host, "smtp.new.invalid");
    await user.click(within(email).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const body = requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body as { email_settings: Record<string, unknown> };
      expect(body.email_settings.smtp_host).toBe("smtp.new.invalid");
      expect(body.email_settings).not.toHaveProperty("smtp_password");
    });
  });
});

describe("Operations", () => {
  it("runs a workflow with instructions and says where the result goes", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=competitor`, state);

    expect(await screen.findByText("Runs in the background and lands in Review, where you approve or reject it.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "After a temporary problem, such as an AI provider error, it tries again by itself, up to 3 attempts. If it still fails, Review says why and you can run it again.",
      ),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Instructions/), "Focus on producers");
    await user.click(screen.getByRole("button", { name: "Run competitor deep-dive" }));

    await waitFor(() =>
      expect(requestsTo(state, "POST", "/api/workflows/launch")[0]?.body).toEqual({
        product_id: project.id,
        workflow_id: "competitor",
        instructions: "Focus on producers",
      }),
    );
    expect(await screen.findByText("Competitor deep-dive started")).toBeInTheDocument();
  });

  it("offers templates tagged for the operation and adds one to the instructions", async () => {
    const project = makeProject();
    const template = (name: string, tags: string[], content: string) => ({ id: id("template"), name, type: "email", tags, content, source_product: "", created_at: "" });
    const state = makeState({
      projects: [project],
      templates: [template("Journalist intro", ["outreach", "email"], "Mention the free tier."), template("Launch thread", ["social"], "Thread copy")],
    });
    const { user } = renderApp(`/projects/${project.id}/operations?run=cold_outreach`, state);

    const add = await screen.findByRole("button", { name: "Add to instructions: Journalist intro" });
    expect(screen.queryByText("Launch thread")).not.toBeInTheDocument();
    await user.click(add);
    expect(screen.getByLabelText(/Instructions/)).toHaveValue("Mention the free tier.");
  });

  it("shows the server's reason when a report can't run", async () => {
    const project = makeProject();
    const state = makeState({
      projects: [project],
      reportResponse: () => HttpResponse.json({ detail: "The AI service isn't available: ANTHROPIC_API_KEY not configured" }, { status: 503 }),
    });
    const { user } = renderApp(`/projects/${project.id}/operations?run=pricing`, state);

    expect(await screen.findByText("You see why here, and any saved version of the report is kept.")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Run pricing strategy" }));

    expect(await screen.findByText("Pricing strategy failed")).toBeInTheDocument();
    expect((await screen.findAllByText("The AI service isn't available: ANTHROPIC_API_KEY not configured")).length).toBeGreaterThan(0);
  });

  it("saves a report and offers to open it", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations?run=pricing`, state);

    await user.type(await screen.findByLabelText(/Notes/), "Target 70% margin");
    await user.click(screen.getByRole("button", { name: "Run pricing strategy" }));

    expect(await screen.findByText("Pricing strategy saved")).toBeInTheDocument();
    expect(requestsTo(state, "POST", "/api/pricing/analyze")[0]?.body).toEqual({ product_id: project.id, notes: "Target 70% margin" });
    // The sheet closes on success; until it unmounts, Radix hides everything outside it from the a11y tree.
    expect(await screen.findByRole("button", { name: "Open" })).toBeInTheDocument();
  });
});
