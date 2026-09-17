import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { Brand } from "@/lib/api/types";
import { API, DATABASE_OUTAGE, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

/** A company as GET /api/brands returns it, including columns the form doesn't edit. */
function makeBrand(overrides: Partial<Brand> = {}): Brand {
  const row = {
    id: "brand-1",
    user_id: "user-1",
    name: "Old Co",
    tagline: "",
    tone: "casual",
    keywords: ["plugins"],
    avoid: [],
    elevator: "",
    company_name: "",
    industry: "Audio",
    location: "Leeds",
    founded: "2019",
    founder_name: "Alex Morgan",
    founder_title: "CEO",
    phone: "",
    email: "press@oldco.example",
    company_size: "",
    boilerplate: "",
    logo_url: "",
    created_at: "2026-09-01T00:00:00+00:00",
    updated_at: "2026-09-01T00:00:00+00:00",
    ...overrides,
  };
  return row;
}

describe("Workspace settings", () => {
  it("saves white-label branding and previews the logo fallback", async () => {
    const state = makeState();
    const { user } = renderApp("/settings", state);

    const company = await screen.findByLabelText(/Company name/);
    await user.clear(company);
    await user.type(company, "Northstar Labs");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect((requestsTo(state, "PUT", "/api/settings")[0]?.body as typeof state.settings).brand.company_name).toBe("Northstar Labs"));
  });

  it("refuses a logo address that isn't http(s)", async () => {
    const { user } = renderApp("/settings", makeState());
    await user.type(await screen.findByLabelText(/Logo URL/), "javascript:alert(1)");
    expect(await screen.findByText("Enter a full https:// address.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("marks a channel in use", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/channels", state);

    await user.click(await screen.findByRole("switch", { name: "Use LinkedIn" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const body = requestsTo(state, "PUT", "/api/settings")[0]?.body as typeof state.settings;
      expect(body.platforms.linkedin?.connected).toBe(true);
      expect(body.platforms.twitter).toEqual({ connected: true, handle: "@north", mode: "manual" });
    });
  });

  it("creates a company, sending only known fields", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/companies", state);

    await user.click(await screen.findByRole("button", { name: "Create a company" }));
    await user.type(await screen.findByLabelText("Company name"), "VybeCod.ing Ltd");
    await user.type(screen.getByLabelText(/Founders/), "Alex Morgan, Sam Lee");
    await user.click(screen.getByRole("button", { name: "Create company" }));

    await waitFor(() => {
      const body = requestsTo(state, "POST", "/api/brands")[0]?.body as Record<string, unknown>;
      expect(body).toMatchObject({ name: "VybeCod.ing Ltd", founder_name: "Alex Morgan, Sam Lee" });
      expect(body).not.toHaveProperty("founders");
    });
    expect(await screen.findByRole("heading", { name: "VybeCod.ing Ltd" })).toBeInTheDocument();
  });

  it("warns how many projects fall back when a company is deleted", async () => {
    const brand = { id: "brand-1", name: "Old Co", industry: "", location: "" } as never;
    const state = makeState({ brands: [brand], projects: [makeProject({ brand_id: "brand-1" })] });
    const { user } = renderApp("/settings/companies", state);

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("1 project uses it. They will fall back to the company details in their own settings.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete company" }));
    await waitFor(() => expect(requestsTo(state, "DELETE", "/api/brands/brand-1")).toHaveLength(1));
  });

  it("falls back to the wordmark when the logo can't be loaded", async () => {
    const { user } = renderApp("/settings", makeState());
    await user.type(await screen.findByLabelText(/Logo URL/), "https://cdn.northstar.example/logo.svg");

    const preview = screen.getByLabelText("Navigation preview");
    fireEvent.error(within(preview).getByRole("img", { name: "Northstar Ventures" }));

    expect(await screen.findByText("That image couldn't be loaded.")).toBeInTheDocument();
    expect(within(preview).queryByRole("img")).not.toBeInTheDocument();
    expect(within(preview).getByText("LaunchOps")).toBeInTheDocument();
  });

  it("saves a channel handle for reference", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/channels", state);

    await user.type(await screen.findByLabelText("LinkedIn handle"), "northstar-ventures");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const body = requestsTo(state, "PUT", "/api/settings")[0]?.body as typeof state.settings;
      expect(body.platforms.linkedin).toEqual({ connected: false, handle: "northstar-ventures", mode: "manual" });
    });
  });

  it("edits a company, sending only the fields the form manages", async () => {
    const state = makeState({ brands: [makeBrand()] });
    const { user } = renderApp("/settings/companies", state);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const sheet = await screen.findByRole("dialog", { name: "Edit Old Co" });
    expect(within(sheet).getByLabelText("Company name")).toHaveValue("Old Co");
    expect(within(sheet).getByLabelText(/Founders/)).toHaveValue("Alex Morgan");
    const industry = within(sheet).getByLabelText(/Industry/);
    await user.clear(industry);
    await user.type(industry, "Audio software");
    await user.click(within(sheet).getByRole("button", { name: "Save company" }));

    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/brands/brand-1")).toHaveLength(1));
    const body = requestsTo(state, "PATCH", "/api/brands/brand-1")[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ name: "Old Co", industry: "Audio software", location: "Leeds", founder_name: "Alex Morgan", tone: "casual", keywords: ["plugins"] });
    for (const column of ["id", "user_id", "created_at", "updated_at"]) expect(body).not.toHaveProperty(column);
    expect(await screen.findByText("Company saved")).toBeInTheDocument();
    expect(await screen.findByText("Audio software · Leeds")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows why a new company couldn't be saved, and can be closed without saving", async () => {
    const state = makeState({ brands: [makeBrand()] });
    const { user } = renderApp("/settings/companies", state);
    server.use(http.post(`${API}/api/brands`, () => HttpResponse.json({ detail: DATABASE_OUTAGE }, { status: 503 })));

    await user.click(await screen.findByRole("button", { name: "New company" }));
    const sheet = await screen.findByRole("dialog", { name: "New company" });
    await user.type(within(sheet).getByLabelText("Company name"), "VybeCod.ing Ltd");
    await user.click(within(sheet).getByRole("button", { name: "Create company" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(DATABASE_OUTAGE);
    expect(within(sheet).getByLabelText("Company name")).toHaveValue("VybeCod.ing Ltd");

    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "VybeCod.ing Ltd" })).not.toBeInTheDocument();
  });

  it("keeps a company when deleting it is cancelled or fails", async () => {
    const state = makeState({ brands: [makeBrand()] });
    const { user } = renderApp("/settings/companies", state);

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    let dialog = await screen.findByRole("alertdialog", { name: "Delete Old Co?" });
    expect(within(dialog).getByText("No projects use it.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(requestsTo(state, "DELETE", "/api/brands")).toEqual([]);

    server.use(http.delete(`${API}/api/brands/:id`, () => HttpResponse.json({ detail: "Brand not found" }, { status: 404 })));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    dialog = await screen.findByRole("alertdialog", { name: "Delete Old Co?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete company" }));

    expect(await screen.findByText("Company not deleted")).toBeInTheDocument();
    expect(screen.getByText("Brand not found")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Delete Old Co?" })).toBeInTheDocument();
  });
});

describe("Voice & AI", () => {
  it("saves AI output preferences without touching the brand voice", async () => {
    const state = makeState();
    const brandBefore = structuredClone(state.settings.brand);
    const { user } = renderApp("/settings/voice", state);

    const prefs = await screen.findByRole("region", { name: "AI output preferences" });
    await user.selectOptions(await within(prefs).findByLabelText("Research depth"), "deep");
    await user.click(within(prefs).getByRole("switch", { name: "Allow emoji in posts" }));
    await user.click(within(prefs).getByRole("switch", { name: "Ask the model to cite sources" }));
    await user.click(within(prefs).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const body = requestsTo(state, "PUT", "/api/settings")[0]?.body as typeof state.settings;
      expect(body.prefs).toEqual({ depth: "deep", length: "medium", emoji: true, hashtags: "minimal", sources: false });
      expect(body.brand).toEqual(brandBefore);
    });
    expect(await screen.findByText("Preferences saved")).toBeInTheDocument();
  });

  it("edits keywords as tags: comma or Enter adds, the cross or Backspace removes", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/voice", state);
    const voice = await screen.findByRole("region", { name: "Brand voice" });
    const keywords = await within(voice).findByLabelText(/Keywords to weave in/);

    await user.type(keywords, "no-code,creative tools{Enter}");
    await user.click(within(voice).getByRole("button", { name: "Remove no-code" }));
    await user.type(keywords, "plugins{Enter}{Backspace}");
    expect(within(voice).queryByRole("button", { name: "Remove plugins" })).not.toBeInTheDocument();
    await user.click(within(voice).getByRole("button", { name: "Save" }));

    await waitFor(() => expect((requestsTo(state, "PUT", "/api/settings")[0]?.body as typeof state.settings).brand.keywords).toEqual(["creative tools"]));
  });

  it("keeps your edits when saving fails, until you discard them", async () => {
    const { user } = renderApp("/settings/voice", makeState());
    server.use(http.put(`${API}/api/settings`, () => HttpResponse.json({ detail: DATABASE_OUTAGE }, { status: 503 })));
    const voice = await screen.findByRole("region", { name: "Brand voice" });
    const name = await within(voice).findByLabelText("Brand name");

    await user.clear(name);
    await user.type(name, "Northstar Labs");
    await user.click(within(voice).getByRole("button", { name: "Save" }));

    expect(await within(voice).findByRole("alert")).toHaveTextContent(DATABASE_OUTAGE);
    expect(name).toHaveValue("Northstar Labs");

    await user.click(within(voice).getByRole("button", { name: "Discard changes" }));
    expect(name).toHaveValue("Northstar");
    expect(within(voice).getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("Team & access", () => {
  it("closes sign-up and changes a member's role", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/team", state);

    await user.click(await screen.findByRole("switch", { name: "Allow anyone to create an account" }));
    await waitFor(() => expect(requestsTo(state, "PUT", "/api/auth/admin/registration")[0]?.body).toEqual({ registration_enabled: false }));

    await user.selectOptions(screen.getByLabelText("Role for sam@northstar.example"), "admin");
    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/auth/admin/users/user-2")[0]?.body).toEqual({ role: "admin" }));
  });

  it("won't let an administrator disable or demote themselves", async () => {
    renderApp("/settings/team", makeState());
    expect(await screen.findByLabelText("Role for jordan@northstar.example")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Disable jordan@northstar.example" })).toBeDisabled();
  });

  it("adds a person", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/team", state);
    const panel = await screen.findByRole("region", { name: "Add a person" });
    await user.type(within(panel).getByLabelText("Email"), "new@northstar.example");
    await user.type(within(panel).getByLabelText("Password"), "long-enough");
    await user.click(within(panel).getByRole("button", { name: "Add person" }));
    await waitFor(() => expect(requestsTo(state, "POST", "/api/auth/admin/users")[0]?.body).toMatchObject({ email: "new@northstar.example" }));
  });

  it("offers Add person only once the password meets the 8-character minimum", async () => {
    const { user } = renderApp("/settings/team", makeState());
    const panel = await screen.findByRole("region", { name: "Add a person" });
    await user.type(within(panel).getByLabelText("Email"), "new@northstar.example");
    await user.type(within(panel).getByLabelText("Password"), "1234567");
    expect(within(panel).getByRole("button", { name: "Add person" })).toBeDisabled();
    await user.type(within(panel).getByLabelText("Password"), "8");
    expect(within(panel).getByRole("button", { name: "Add person" })).toBeEnabled();
  });

  it("is only available to administrators", async () => {
    const state = makeState();
    state.user = { ...state.user, role: "user" };
    renderApp("/settings/team", state);
    expect(await screen.findByLabelText(/Company name/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Team & access" })).not.toBeInTheDocument();
  });

  it("disables a member's access and lets them back in", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/team", state);

    await user.click(await screen.findByRole("switch", { name: "Disable sam@northstar.example" }));
    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/auth/admin/users/user-2")[0]?.body).toEqual({ enabled: false }));
    expect(await screen.findByText("sam@northstar.example is disabled")).toBeInTheDocument();

    await user.click(await screen.findByRole("switch", { name: "Enable sam@northstar.example" }));
    await waitFor(() => expect(requestsTo(state, "PATCH", "/api/auth/admin/users/user-2")[1]?.body).toEqual({ enabled: true }));
    expect(await screen.findByText("sam@northstar.example can sign in")).toBeInTheDocument();
  });

  it("says when a change isn't saved and leaves the role as it was", async () => {
    const { user } = renderApp("/settings/team", makeState());
    const role = await screen.findByLabelText("Role for sam@northstar.example");
    server.use(http.patch(`${API}/api/auth/admin/users/:id`, () => HttpResponse.json({ detail: "User not found" }, { status: 404 })));

    await user.selectOptions(role, "admin");

    expect(await screen.findByText("Change not saved")).toBeInTheDocument();
    expect(screen.getByText("User not found")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Role for sam@northstar.example")).toHaveValue("user"));
  });

  it("deletes someone else's account only after confirmation", async () => {
    const state = makeState();
    const { user } = renderApp("/settings/team", state);
    const remove = await screen.findByRole("button", { name: "Delete sam@northstar.example" });
    expect(screen.queryByRole("button", { name: "Delete jordan@northstar.example" })).not.toBeInTheDocument();

    await user.click(remove);
    let dialog = await screen.findByRole("alertdialog", { name: "Delete sam@northstar.example?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(requestsTo(state, "DELETE", "/api/auth/admin/users")).toEqual([]);

    await user.click(remove);
    dialog = await screen.findByRole("alertdialog", { name: "Delete sam@northstar.example?" });
    expect(within(dialog).getByText(/Organisations only they belong to are deleted with everything in them/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(requestsTo(state, "DELETE", "/api/auth/admin/users/user-2")).toHaveLength(1));
    expect(await screen.findByText("sam@northstar.example deleted")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Role for sam@northstar.example")).not.toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows why a person couldn't be added and keeps the form filled in", async () => {
    const { user } = renderApp("/settings/team", makeState());
    server.use(http.post(`${API}/api/auth/admin/users`, () => HttpResponse.json({ detail: "An account with this email already exists" }, { status: 409 })));
    const panel = await screen.findByRole("region", { name: "Add a person" });

    await user.type(within(panel).getByLabelText("Email"), "sam@northstar.example");
    await user.type(within(panel).getByLabelText("Password"), "long-enough");
    await user.click(within(panel).getByRole("button", { name: "Add person" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent("An account with this email already exists");
    expect(within(panel).getByLabelText("Email")).toHaveValue("sam@northstar.example");
  });

  /** Picks a project and a new owner in "Transfer a project" and opens the confirmation. */
  async function startTransfer(user: ReturnType<typeof renderApp>["user"]) {
    const panel = await screen.findByRole("region", { name: "Transfer a project" });
    const transfer = within(panel).getByRole("button", { name: "Transfer…" });
    expect(transfer).toBeDisabled();

    await within(panel).findByRole("option", { name: "Tessera Health — jordan@northstar.example" });
    await user.selectOptions(within(panel).getByLabelText("Project"), "Tessera Health — jordan@northstar.example");
    const owner = within(panel).getByLabelText("New owner");
    // The current owner isn't offered.
    expect(within(owner).queryByRole("option", { name: /jordan@northstar\.example/ })).not.toBeInTheDocument();
    await user.selectOptions(owner, "Sam Rivera — sam@northstar.example");
    await user.click(transfer);

    return { panel, transfer, dialog: await screen.findByRole("alertdialog", { name: "Transfer Tessera Health?" }) };
  }

  it("transfers a project to another person after confirmation", async () => {
    const project = makeProject({ name: "Tessera Health" });
    const state = makeState({ projects: [project] });
    const { user } = renderApp("/settings/team", state);

    const { panel, transfer, dialog } = await startTransfer(user);
    expect(within(dialog).getByText("It moves into sam@northstar.example's own organisation. People in its current organisation lose access to it.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Transfer project" }));

    await waitFor(() => expect(requestsTo(state, "POST", "/api/auth/admin/transfer-project")[0]?.body).toEqual({ product_id: project.id, target_user_id: "user-2" }));
    expect(await screen.findByText("Tessera Health transferred to sam@northstar.example")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(within(panel).getByLabelText("Project")).toHaveValue("");
    expect(transfer).toBeDisabled();
  });

  it("says why a transfer failed and leaves the confirmation open", async () => {
    const state = makeState({ projects: [makeProject({ name: "Tessera Health" })] });
    const { user } = renderApp("/settings/team", state);
    server.use(http.post(`${API}/api/auth/admin/transfer-project`, () => HttpResponse.json({ detail: "Target user not found" }, { status: 404 })));

    const { dialog } = await startTransfer(user);
    await user.click(within(dialog).getByRole("button", { name: "Transfer project" }));

    expect(await screen.findByText("Transfer failed")).toBeInTheDocument();
    expect(screen.getByText("Target user not found")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Transfer project" })).toBeEnabled();
  });
});
