import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { QueueItem } from "@/lib/api/types";
import { id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { changesRequested, stateAs } from "./roles";

// What each organisation role sees in a project: its header, overview, operations, reports, launch plan and settings
// (docs/PHASE1_DESIGN.md, D2).

const pricing = { tiers: [{ name: "Creator", price: "$12/mo" }], generated_at: "2026-09-12T13:46:00+00:00" };

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

const idea = (productId: string, text: string) => ({ id: id("capture"), text, product_id: productId, created_at: new Date().toISOString() });

describe("Project overview by role", () => {
  it("shows a viewer the project without the controls that change it", async () => {
    // No launch date or company, and a description under 80 characters: several next steps are open.
    const project = makeProject({ name: "Fieldnote", launch_date: null });
    const state = stateAs("viewer", {
      projects: [project],
      queue: [queueItem({ product_id: project.id })],
      captures: [idea(project.id, "Studio tour video")],
    });
    renderApp(`/projects/${project.id}`, state);

    await screen.findByRole("heading", { level: 1, name: /Fieldnote/ });
    const main = screen.getByRole("main");
    expect(within(main).queryByRole("button", { name: "Capture idea" })).not.toBeInTheDocument();
    expect(within(main).queryByRole("link", { name: "Run an operation" })).not.toBeInTheDocument();

    const launch = screen.getByRole("region", { name: "Launch" });
    expect(within(launch).getByText("You can view the launch status and date. Changing them needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(launch).getByLabelText("Status")).toHaveValue("pre_launch");
    expect(within(launch).getByLabelText("Status")).toBeDisabled();
    expect(within(launch).getByLabelText("Launch date")).toBeDisabled();

    // Steps the viewer can't take are listed without a link; reviewing results is still open to them.
    const steps = screen.getByRole("region", { name: "Next steps" });
    expect(await within(steps).findByRole("link", { name: "Review 1 result" })).toBeInTheDocument();
    expect(within(steps).getByText("Set a launch date")).toBeInTheDocument();
    expect(within(steps).getByText("Generate the market analysis")).toBeInTheDocument();
    expect(within(steps).getAllByRole("link")).toHaveLength(1);

    const reports = screen.getByRole("region", { name: "Reports" });
    expect(within(reports).queryByRole("link", { name: "Generate" })).not.toBeInTheDocument();

    const ideas = screen.getByRole("region", { name: "Ideas" });
    expect(await within(ideas).findByText("Studio tour video")).toBeInTheDocument();
    expect(within(ideas).queryByRole("button", { name: "Capture" })).not.toBeInTheDocument();
    expect(within(ideas).queryByRole("button", { name: "Delete idea" })).not.toBeInTheDocument();
    expect(within(ideas).queryByRole("link", { name: "Use in an operation" })).not.toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("tells a viewer that capturing ideas needs the Editor role when a project has none", async () => {
    const project = makeProject();
    renderApp(`/projects/${project.id}`, stateAs("viewer", { projects: [project] }));

    const ideas = await screen.findByRole("region", { name: "Ideas" });
    expect(within(ideas).getByText("Capturing ideas needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
  });

  it("lets an editor change the launch status and capture ideas", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const state = stateAs("editor", { projects: [project], captures: [idea(project.id, "Studio tour video")] });
    const { user } = renderApp(`/projects/${project.id}`, state);

    const launch = await screen.findByRole("region", { name: "Launch" });
    expect(within(launch).queryByText(/You can view/)).not.toBeInTheDocument();
    await user.selectOptions(within(launch).getByLabelText("Status"), "launched");
    expect(await screen.findByText("Status set to Launched")).toBeInTheDocument();
    expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body).toEqual({ status: "launched" });

    const ideas = screen.getByRole("region", { name: "Ideas" });
    expect(await within(ideas).findByRole("link", { name: "Use in an operation" })).toBeInTheDocument();
    expect(within(ideas).getByRole("button", { name: "Delete idea" })).toBeInTheDocument();
    expect(within(ideas).getByRole("button", { name: "Capture" })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("button", { name: "Capture idea" })).toBeInTheDocument();
  });

  it("still gives an owner the header actions, next step links and Generate", async () => {
    const project = makeProject({ name: "Fieldnote", launch_date: null });
    renderApp(`/projects/${project.id}`, makeState({ projects: [project], captures: [idea(project.id, "Studio tour video")] }));

    expect(await screen.findByRole("link", { name: "Run an operation" })).toHaveAttribute("href", `/projects/${project.id}/operations`);
    const steps = screen.getByRole("region", { name: "Next steps" });
    expect(within(steps).getByRole("link", { name: "Set a launch date" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Reports" })).getAllByRole("link", { name: "Generate" })).toHaveLength(5);
    expect(await within(screen.getByRole("region", { name: "Ideas" })).findByRole("link", { name: "Use in an operation" })).toBeInTheDocument();
  });
});

describe("Operations by role", () => {
  it("lists operations for a viewer without Run, and says why", async () => {
    const project = makeProject({ pricing_result: pricing });
    const state = stateAs("viewer", { projects: [project] });
    renderApp(`/projects/${project.id}/operations`, state);

    expect(await screen.findByText("Running operations needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Research" })).toHaveTextContent("Competitor deep-dive");
    expect(screen.queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open report" })).toHaveAttribute("href", `/projects/${project.id}/reports/pricing`);
  });

  it("shows a viewer what an operation does, but not a way to run it", async () => {
    const project = makeProject();
    const state = stateAs("viewer", { projects: [project] });
    const { user, router } = renderApp(`/projects/${project.id}/operations?run=competitor`, state);

    const sheet = await screen.findByRole("dialog", { name: "Run competitor deep-dive" });
    expect(within(sheet).getByText("Runs in the background and lands in Review, where you approve or reject it.")).toBeInTheDocument();
    expect(within(sheet).getByText("Running this operation needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(sheet).queryByLabelText(/Instructions/)).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Run competitor deep-dive" })).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Close panel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.state.location.search).toBe("");
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor run an operation", async () => {
    const project = makeProject();
    const state = stateAs("editor", { projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/operations`, state);

    const research = await screen.findByRole("region", { name: "Research" });
    expect(screen.queryByText(/Running operations needs/)).not.toBeInTheDocument();
    const competitor = within(research)
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText("Competitor deep-dive"))!;
    await user.click(within(competitor).getByRole("button", { name: "Run" }));
    await user.click(await screen.findByRole("button", { name: "Run competitor deep-dive" }));

    expect(await screen.findByText("Competitor deep-dive started")).toBeInTheDocument();
    expect(state.queue.map((q) => q.workflow_id)).toEqual(["competitor"]);
  });
});

describe("Reports by role", () => {
  it("lets a viewer open and export reports, but not generate or run them again", async () => {
    const project = makeProject({ pricing_result: pricing });
    const state = stateAs("viewer", { projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/reports`, state);

    const open = await screen.findByRole("link", { name: "Open pricing strategy" });
    expect(screen.queryByRole("link", { name: /^Run again/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Generate/ })).not.toBeInTheDocument();

    await user.click(open);
    expect(await screen.findByRole("heading", { level: 1, name: "Pricing strategy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Run again" })).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("navigation", { name: "Reports" })).getByRole("link", { name: "SEO metadata" }));
    expect(await screen.findByText("No SEO metadata yet")).toBeInTheDocument();
    expect(screen.getByText("Generating reports needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Generate/ })).not.toBeInTheDocument();
    expect(changesRequested(state)).toEqual([]);
  });

  it("still offers an owner Run again and Generate", async () => {
    const project = makeProject({ pricing_result: pricing });
    const { user } = renderApp(`/projects/${project.id}/reports`, makeState({ projects: [project] }));

    expect(await screen.findByRole("link", { name: "Run again: pricing strategy" })).toHaveAttribute("href", `/projects/${project.id}/operations?run=pricing`);
    expect(screen.getAllByRole("link", { name: /^Generate/ })).toHaveLength(4);
    await user.click(screen.getByRole("link", { name: "Open pricing strategy" }));
    expect(await screen.findByRole("link", { name: "Run again" })).toHaveAttribute("href", `/projects/${project.id}/operations?run=pricing`);
  });
});

describe("Launch plan by role", () => {
  it("shows a viewer the plan with every item locked", async () => {
    const project = makeProject({ checklist: { "Pre-Launch_0": true, "_custom_Pre-Launch": ["Record demo"] } });
    const state = stateAs("viewer", { projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/plan`, state);

    expect(
      await screen.findByText("You can view the launch plan. Ticking items or adding your own needs the Editor role in Northstar Ventures."),
    ).toBeInTheDocument();
    const beta = await screen.findByLabelText("Beta testers recruited");
    expect(beta).toBeDisabled();
    expect(screen.getByLabelText("Record demo")).toBeDisabled();
    expect(screen.queryByRole("button", { name: 'Remove "Record demo"' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New Pre-launch item")).not.toBeInTheDocument();

    await user.click(beta);
    expect(beta).not.toBeChecked();
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor tick items and add their own", async () => {
    const project = makeProject({ checklist: {} });
    const state = stateAs("editor", { projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/plan`, state);

    await user.click(await screen.findByLabelText("Beta testers recruited"));
    await user.type(screen.getByLabelText("New Pre-launch item"), "Record demo{Enter}");

    await waitFor(() => expect(state.projects[0]?.checklist).toEqual({ "Pre-Launch_5": true, "_custom_Pre-Launch": ["Record demo"] }));
    expect(screen.queryByText(/You can view the launch plan/)).not.toBeInTheDocument();
  });
});

describe("Project settings by role", () => {
  it("shows a viewer the settings locked, and says deleting the project needs the Owner role", async () => {
    const project = makeProject({ name: "Tessera Health", email_settings: { smtp_host: "smtp.tessera.example", smtp_user: "launch" } });
    const state = stateAs("viewer", { projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    expect(await screen.findByText("You can view this project's settings. Changing them needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    const details = screen.getByRole("region", { name: "Project details" });
    const name = within(details).getByLabelText("Name");
    expect(name).toHaveValue("Tessera Health");
    expect(name).toBeDisabled();
    expect(within(details).getByRole("button", { name: "Service" })).toBeDisabled();
    expect(within(details).getByRole("radio", { name: "Teal" })).toBeDisabled();
    expect(within(details).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(screen.getByRole("region", { name: "Company" })).getByLabelText("Company profile")).toBeDisabled();
    const email = screen.getByRole("region", { name: "Email server" });
    expect(within(email).getByLabelText("SMTP host")).toHaveValue("smtp.tessera.example");
    expect(within(email).getByLabelText("SMTP host")).toBeDisabled();
    expect(within(email).getByLabelText("Password")).toBeDisabled();
    expect(within(email).getByRole("switch", { name: "Use STARTTLS" })).toBeDisabled();

    const danger = screen.getByRole("region", { name: "Delete project" });
    expect(within(danger).getByText("Deleting a project needs the Owner role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(danger).queryByRole("button")).not.toBeInTheDocument();

    await user.type(name, " Labs");
    expect(name).toHaveValue("Tessera Health");
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor change the settings, but not delete the project", async () => {
    const project = makeProject({ name: "Tessera Health" });
    const state = stateAs("editor", { projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    const details = await screen.findByRole("region", { name: "Project details" });
    expect(screen.queryByText(/You can view this project's settings/)).not.toBeInTheDocument();
    const tagline = within(details).getByLabelText(/^Tagline/);
    await user.clear(tagline);
    await user.type(tagline, "Patient intake for small clinics");
    await user.click(within(details).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Project details saved")).toBeInTheDocument();
    expect(state.projects[0]?.tagline).toBe("Patient intake for small clinics");

    const danger = screen.getByRole("region", { name: "Delete project" });
    expect(within(danger).getByText("Deleting a project needs the Owner role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(danger).queryByRole("button", { name: "Delete Tessera Health…" })).not.toBeInTheDocument();
  });

  it("doesn't let an approver delete a project either", async () => {
    const project = makeProject({ name: "Tessera Health" });
    renderApp(`/projects/${project.id}/settings`, stateAs("approver", { projects: [project] }));

    const danger = await screen.findByRole("region", { name: "Delete project" });
    expect(within(danger).getByText("Deleting a project needs the Owner role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(danger).queryByRole("button")).not.toBeInTheDocument();
  });
});
