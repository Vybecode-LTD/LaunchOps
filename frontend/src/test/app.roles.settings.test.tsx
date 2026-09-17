import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Brand } from "@/lib/api/types";
import { renderApp } from "./renderApp";
import { changesRequested, stateAs } from "./roles";

// What each organisation role can change in Settings (docs/PHASE1_DESIGN.md, D2). Organisation, Activity and
// Team & access have their own tests.

const brand: Brand = {
  id: "brand-1",
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
  boilerplate: "Old Co makes plugins.",
  logo_url: "",
  created_at: "2026-09-01T00:00:00+00:00",
  updated_at: "2026-09-01T00:00:00+00:00",
};

describe("General settings by role", () => {
  it("shows a viewer the workspace branding without letting them change it, and leaves the theme theirs", async () => {
    const state = stateAs("viewer");
    const { user } = renderApp("/settings", state);

    const branding = await screen.findByRole("region", { name: "Workspace branding" });
    expect(await within(branding).findByText("You can view the workspace branding. Changing it needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    const company = within(branding).getByLabelText(/Company name/);
    expect(company).toHaveValue("Northstar Ventures");
    expect(company).toBeDisabled();
    expect(within(branding).getByLabelText(/Logo URL/)).toBeDisabled();
    expect(within(branding).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(screen.getByRole("group", { name: "Theme" })).getByRole("button", { name: "Dark" })).toBeEnabled();

    await user.type(company, " Labs");
    expect(company).toHaveValue("Northstar Ventures");
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor change the workspace branding", async () => {
    const state = stateAs("editor");
    const { user } = renderApp("/settings", state);

    const company = await screen.findByLabelText(/Company name/);
    expect(screen.queryByText(/You can view the workspace branding/)).not.toBeInTheDocument();
    await user.clear(company);
    await user.type(company, "Northstar Labs");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Branding saved")).toBeInTheDocument();
    expect(state.settings.brand.company_name).toBe("Northstar Labs");
  });
});

describe("Voice & AI by role", () => {
  it("shows a viewer the brand voice and AI output preferences, locked", async () => {
    const state = stateAs("viewer");
    const { user } = renderApp("/settings/voice", state);

    expect(
      await screen.findByText("You can view the brand voice and AI output preferences. Changing them needs the Editor role in Northstar Ventures."),
    ).toBeInTheDocument();
    const voice = screen.getByRole("region", { name: "Brand voice" });
    expect(await within(voice).findByLabelText("Brand name")).toHaveValue("Northstar");
    expect(within(voice).getByLabelText("Brand name")).toBeDisabled();
    expect(within(voice).getByLabelText("Tone")).toBeDisabled();
    expect(within(voice).getByLabelText(/Keywords to weave in/)).toBeDisabled();

    const prefs = screen.getByRole("region", { name: "AI output preferences" });
    expect(within(prefs).getByLabelText("Research depth")).toBeDisabled();
    const emoji = within(prefs).getByRole("switch", { name: "Allow emoji in posts" });
    expect(emoji).toBeDisabled();
    await user.click(emoji);
    expect(emoji).not.toBeChecked();
    expect(within(prefs).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor save AI output preferences", async () => {
    const state = stateAs("editor");
    const { user } = renderApp("/settings/voice", state);

    const prefs = await screen.findByRole("region", { name: "AI output preferences" });
    await user.click(await within(prefs).findByRole("switch", { name: "Allow emoji in posts" }));
    await user.click(within(prefs).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Preferences saved")).toBeInTheDocument();
    expect(state.settings.prefs.emoji).toBe(true);
  });
});

describe("Channels by role", () => {
  it("shows a viewer which channels are in use, locked", async () => {
    const state = stateAs("viewer");
    const { user } = renderApp("/settings/channels", state);

    expect(await screen.findByText("You can view the channels. Changing them needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    const twitter = await screen.findByRole("switch", { name: "Use X (Twitter)" });
    expect(twitter).toBeChecked();
    expect(twitter).toBeDisabled();
    expect(screen.getByLabelText("X (Twitter) handle")).toHaveValue("@north");
    expect(screen.getByLabelText("X (Twitter) handle")).toBeDisabled();

    await user.click(screen.getByRole("switch", { name: "Use LinkedIn" }));
    expect(screen.getByRole("switch", { name: "Use LinkedIn" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(changesRequested(state)).toEqual([]);
  });

  it("lets an editor mark a channel in use", async () => {
    const state = stateAs("editor");
    const { user } = renderApp("/settings/channels", state);

    await user.click(await screen.findByRole("switch", { name: "Use LinkedIn" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Channels saved")).toBeInTheDocument();
    expect(state.settings.platforms.linkedin?.connected).toBe(true);
  });
});

describe("Companies by role", () => {
  it("lets a viewer open and read company profiles, but not add, change or delete them", async () => {
    const state = stateAs("viewer", { brands: [brand] });
    const { user } = renderApp("/settings/companies", state);

    expect(await screen.findByText("You can view the company profiles. Adding or changing them needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Old Co" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New company" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View" }));
    const sheet = await screen.findByRole("dialog", { name: "View Old Co" });
    expect(within(sheet).getByText("You can view this company profile. Changing it needs the Editor role in Northstar Ventures.")).toBeInTheDocument();
    expect(within(sheet).getByLabelText("Company name")).toHaveValue("Old Co");
    expect(within(sheet).getByLabelText("Company name")).toBeDisabled();
    expect(within(sheet).getByLabelText(/Boilerplate/)).toHaveValue("Old Co makes plugins.");
    expect(within(sheet).getByLabelText(/Boilerplate/)).toBeDisabled();
    expect(within(sheet).queryByRole("button", { name: "Save company" })).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Close panel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(changesRequested(state)).toEqual([]);
  });

  it("doesn't offer a viewer to create the first company", async () => {
    renderApp("/settings/companies", stateAs("viewer"));

    expect(await screen.findByText("No companies yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create a company" })).not.toBeInTheDocument();
  });

  it("lets an editor add, change and delete company profiles", async () => {
    const state = stateAs("editor", { brands: [brand] });
    const { user } = renderApp("/settings/companies", state);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const sheet = await screen.findByRole("dialog", { name: "Edit Old Co" });
    expect(within(sheet).queryByText(/You can view this company profile/)).not.toBeInTheDocument();
    const industry = within(sheet).getByLabelText(/Industry/);
    await user.clear(industry);
    await user.type(industry, "Audio software");
    await user.click(within(sheet).getByRole("button", { name: "Save company" }));
    expect(await screen.findByText("Company saved")).toBeInTheDocument();
    expect(state.brands[0]?.industry).toBe("Audio software");

    expect(screen.getByRole("button", { name: "New company" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete Old Co?" });
    await user.click(within(confirm).getByRole("button", { name: "Delete company" }));
    await waitFor(() => expect(state.brands).toEqual([]));
  });
});
