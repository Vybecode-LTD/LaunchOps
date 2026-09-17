import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { addDays, toDateKey } from "@/lib/domain/dates";
import { UNDO_WINDOW_MS } from "@/lib/queries/hooks";
import { id, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";

const today = toDateKey(new Date());

describe("Sign-in", () => {
  it("sends a signed-out visitor to sign in, then back to the page they wanted", async () => {
    const state = makeState();
    const { user } = renderApp("/calendar", state, { signedIn: false });

    await user.type(await screen.findByLabelText("Email"), "jordan@northstar.example");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Calendar" })).toBeInTheDocument();
    expect(localStorage.getItem("launchops_token")).toBe("token-1");
  });

  it("shows the server's message for a wrong password", async () => {
    const { user } = renderApp("/portfolio", makeState(), { signedIn: false });

    await user.type(await screen.findByLabelText("Email"), "jordan@northstar.example");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });
});

describe("Portfolio", () => {
  it("orders the launch board by what needs attention", async () => {
    const state = makeState({
      projects: [
        makeProject({ name: "Fieldnote", launch_date: addDays(today, 40) }),
        makeProject({ name: "Orbit Payroll", status: "launched", launch_date: addDays(today, -10) }),
        makeProject({ name: "Tessera Health", launch_date: addDays(today, -2) }),
        makeProject({ name: "Halcyon Studio", launch_date: addDays(today, 5) }),
      ],
    });
    renderApp("/portfolio", state);

    const board = await screen.findByRole("table");
    await waitFor(() => expect(within(board).getAllByRole("row")).toHaveLength(5));
    const names = within(board)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names).toEqual(["Tessera Health", "Halcyon Studio", "Fieldnote", "Orbit Payroll"]);
    expect(within(board).getByRole("button", { name: /^Overdue/ })).toBeInTheDocument();
    expect(within(board).getByRole("button", { name: /^At risk/ })).toBeInTheDocument();
  });
});

describe("Settings", () => {
  it("saving the brand voice keeps the other settings intact", async () => {
    const state = makeState();
    const platformsBefore = structuredClone(state.settings.platforms);
    const { user } = renderApp("/settings/voice", state);

    const name = await screen.findByLabelText("Brand name");
    await user.clear(name);
    await user.type(name, "Northstar Labs");
    const voice = screen.getByRole("region", { name: "Brand voice" });
    await user.click(within(voice).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const body = requestsTo(state, "PUT", "/api/settings")[0]?.body as typeof state.settings;
      expect(body.brand.name).toBe("Northstar Labs");
      expect(body.brand.company_name).toBe("Northstar Ventures");
      expect(body.platforms).toEqual(platformsBefore);
    });
  });
});

describe("Undoable delete", () => {
  it("brings an idea back on Undo and never sends the delete", async () => {
    const project = makeProject();
    const idea = { id: id("capture"), text: "Ask producers for testimonials", product_id: project.id, created_at: new Date().toISOString() };
    const state = makeState({ projects: [project], captures: [idea] });
    const { user } = renderApp("/library?tab=ideas", state);

    await user.click(await screen.findByRole("button", { name: "Delete idea" }));
    await waitFor(() => expect(screen.queryByText("Ask producers for testimonials")).not.toBeInTheDocument());

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Ask producers for testimonials")).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, UNDO_WINDOW_MS + 300));
    expect(requestsTo(state, "DELETE", "/api/captures")).toEqual([]);
  }, 20_000);

  it("sends the delete once the undo window closes", async () => {
    const project = makeProject();
    const idea = { id: id("capture"), text: "Pitch accelerators", product_id: project.id, created_at: new Date().toISOString() };
    const state = makeState({ projects: [project], captures: [idea] });
    const { user } = renderApp("/library?tab=ideas", state);

    await user.click(await screen.findByRole("button", { name: "Delete idea" }));
    await waitFor(() => expect(requestsTo(state, "DELETE", `/api/captures/${idea.id}`)).toHaveLength(1), { timeout: UNDO_WINDOW_MS + 3000 });
  }, 20_000);
});
