import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { Brand } from "@/lib/api/types";
import { API, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

// More project settings behaviour; assigning a company, keeping a saved password and deleting a
// project are in app.project.test.tsx and app.projectPages.test.tsx.

const OFFLINE = "Can't reach the LaunchOps server. Check your connection and try again.";

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

describe("Project details", () => {
  it("saves only the details you changed", async () => {
    const project = makeProject({ tagline: "Design audio plugins without code", keywords: ["audio"], color: "#7654d8", project_type: "product" });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    const details = await screen.findByRole("region", { name: "Project details" });
    const save = within(details).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await user.click(within(details).getByRole("button", { name: "Service" }));
    const tagline = within(details).getByLabelText(/^Tagline/);
    await user.clear(tagline);
    await user.type(tagline, "Build plugins visually");
    await user.type(within(details).getByLabelText(/^Keywords/), "plugins{Enter}");
    await user.click(within(details).getByRole("radio", { name: "Teal" }));
    expect(within(details).getByRole("radio", { name: "Teal" })).toBeChecked();
    expect(within(details).getByRole("radio", { name: "Violet" })).not.toBeChecked();
    await user.click(save);

    await waitFor(() =>
      expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body).toEqual({
        project_type: "service",
        tagline: "Build plugins visually",
        keywords: ["audio", "plugins"],
        color: "#0f8b8d",
      }),
    );
    expect(await screen.findByText("Project details saved")).toBeInTheDocument();
    await waitFor(() => expect(save).toBeDisabled());
  });

  it("shows the server's reason when the details can't be saved", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);
    // What the backend's validation answers for a blank name.
    server.use(
      http.patch(`${API}/api/products/:id`, () =>
        HttpResponse.json({ detail: [{ type: "value_error", loc: ["body", "name"], msg: "Value error, name must not be empty", input: "" }] }, { status: 422 }),
      ),
    );

    const details = await screen.findByRole("region", { name: "Project details" });
    const name = within(details).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "   ");
    await user.click(within(details).getByRole("button", { name: "Save" }));

    expect(await within(details).findByRole("alert")).toHaveTextContent("Value error, name must not be empty");
    expect(screen.queryByText("Project details saved")).not.toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("discards unsaved edits in each section without saving them", async () => {
    const project = makeProject({ email_settings: { smtp_host: "smtp.old.invalid", smtp_user: "u" } });
    const state = makeState({ projects: [project], brands: [brand] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    const details = await screen.findByRole("region", { name: "Project details" });
    const name = within(details).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Renamed");
    await user.click(within(details).getByRole("button", { name: "Discard changes" }));
    expect(name).toHaveValue("VybeCode DSP");
    expect(within(details).getByRole("button", { name: "Save" })).toBeDisabled();

    const company = screen.getByRole("region", { name: "Company" });
    await within(company).findByRole("option", { name: "VybeCod.ing Ltd (Music technology)" });
    await user.selectOptions(within(company).getByLabelText("Company profile"), "brand-1");
    expect(within(company).queryByLabelText(/^Company name/)).not.toBeInTheDocument();
    await user.click(within(company).getByRole("button", { name: "Discard changes" }));
    expect(within(company).getByLabelText("Company profile")).toHaveValue("");
    expect(within(company).getByLabelText(/^Company name/)).toBeInTheDocument();

    const email = screen.getByRole("region", { name: "Email server" });
    const host = within(email).getByLabelText("SMTP host");
    await user.clear(host);
    await user.type(host, "smtp.new.invalid");
    await user.type(within(email).getByLabelText("Password"), "app-password-1");
    await user.click(within(email).getByRole("button", { name: "Discard changes" }));
    expect(host).toHaveValue("smtp.old.invalid");
    expect(within(email).getByLabelText("Password")).toHaveValue("");

    expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)).toEqual([]);
  });
});

describe("Email server settings", () => {
  it("saves a new SMTP password and never shows it again", async () => {
    const project = makeProject({ email_settings: { smtp_host: "smtp.northstar.example", smtp_user: "launch@northstar.example", use_tls: true } });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    const email = await screen.findByRole("region", { name: "Email server" });
    const password = within(email).getByLabelText("Password");
    expect(password).toHaveAccessibleDescription("Stored for sending only; never shown again.");

    await user.type(password, "app-password-1");
    const port = within(email).getByLabelText("Port");
    await user.clear(port);
    await user.type(port, "25x25");
    expect(port).toHaveValue("2525");
    await user.click(within(email).getByRole("switch", { name: "Use STARTTLS" }));
    await user.click(within(email).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(requestsTo(state, "PATCH", `/api/products/${project.id}`)[0]?.body).toEqual({
        email_settings: {
          smtp_host: "smtp.northstar.example",
          smtp_port: 2525,
          smtp_user: "launch@northstar.example",
          from_name: "",
          from_email: "",
          reply_to: "",
          use_tls: false,
          smtp_password: "app-password-1",
        },
      }),
    );
    expect(await screen.findByText("Email server saved")).toBeInTheDocument();
    await waitFor(() => expect(password).toHaveValue(""));
    expect(password).toHaveAccessibleDescription("A password is saved. Leave blank to keep it.");
    expect(within(email).getByRole("switch", { name: "Use STARTTLS" })).not.toBeChecked();
  });
});

describe("Deleting a project", () => {
  it("forgets the typed name when the dialog is cancelled", async () => {
    const project = makeProject({ name: "Tessera Health" });
    const state = makeState({ projects: [project] });
    const { user } = renderApp(`/projects/${project.id}/settings`, state);

    await user.click(await screen.findByRole("button", { name: "Delete Tessera Health…" }));
    let dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Type Tessera Health to confirm"), "Tessera Health");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Delete Tessera Health…" }));
    dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByLabelText("Type Tessera Health to confirm")).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "Delete project" })).toBeDisabled();
    expect(requestsTo(state, "DELETE", `/api/products/${project.id}`)).toEqual([]);
  });

  it("stays on the project and says why when it can't be deleted", async () => {
    const project = makeProject({ name: "Tessera Health" });
    const state = makeState({ projects: [project] });
    const { user, router } = renderApp(`/projects/${project.id}/settings`, state);
    server.use(http.delete(`${API}/api/products/:id`, () => HttpResponse.error()));

    await user.click(await screen.findByRole("button", { name: "Delete Tessera Health…" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Type Tessera Health to confirm"), "Tessera Health");
    await user.click(within(dialog).getByRole("button", { name: "Delete project" }));

    expect(await screen.findByText("Project not deleted")).toBeInTheDocument();
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/projects/${project.id}/settings`);
  });
});
