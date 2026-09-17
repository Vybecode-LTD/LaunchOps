import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, DATABASE_OUTAGE, makeProject, makeState } from "./fakeApi";
import { renderApp, requestsTo } from "./renderApp";
import { server } from "./server";

const root = document.documentElement;

afterEach(() => root.removeAttribute("data-theme"));

type User = ReturnType<typeof renderApp>["user"];

async function openPalette(user: User) {
  await user.keyboard("{Control>}k{/Control}");
  return screen.findByRole("dialog", { name: "Search and run" });
}

async function choose(user: User, option: string | RegExp) {
  const palette = await openPalette(user);
  await user.click(within(palette).getByRole("option", { name: option }));
}

describe("Command palette", () => {
  it("runs an operation on the project you're viewing", async () => {
    const project = makeProject({ name: "Fieldnote" });
    const { user, router } = renderApp(`/projects/${project.id}`, makeState({ projects: [project] }));
    await screen.findByRole("heading", { level: 1, name: /Fieldnote/ });

    const palette = await openPalette(user);
    const operations = within(palette).getByRole("group", { name: "Run on Fieldnote" });
    await user.click(within(operations).getByRole("option", { name: /^Pricing strategy/ }));

    expect(await screen.findByRole("button", { name: "Run pricing strategy" })).toBeInTheDocument();
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(`/projects/${project.id}/operations?run=pricing`);
  });

  it("only offers operations while a project is open", async () => {
    const { user } = renderApp("/portfolio", makeState({ projects: [makeProject({ name: "Fieldnote" })] }));
    await screen.findByRole("heading", { level: 1, name: "Portfolio" });

    const palette = await openPalette(user);
    expect(within(palette).queryByRole("group", { name: /^Run on/ })).not.toBeInTheDocument();
    expect(within(palette).getByRole("group", { name: "Projects" })).toBeInTheDocument();
  });

  it("captures an idea against the open project, or starts a new project", async () => {
    const other = makeProject({ name: "Halcyon Studio" });
    const project = makeProject({ name: "Fieldnote" });
    const { user } = renderApp(`/projects/${project.id}`, makeState({ projects: [other, project] }));
    await screen.findByRole("heading", { level: 1, name: /Fieldnote/ });

    await choose(user, "Capture an idea");
    const capture = await screen.findByRole("dialog", { name: "Capture an idea" });
    expect(within(capture).getByLabelText("Project")).toHaveValue(project.id);
    await user.click(within(capture).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await choose(user, "New project");
    expect(await screen.findByRole("dialog", { name: "New project" })).toBeInTheDocument();
  });

  it("switches the theme", async () => {
    const { user } = renderApp("/portfolio", makeState());
    await screen.findByRole("heading", { level: 1, name: "Portfolio" });

    await choose(user, "Use dark theme");
    expect(root).toHaveAttribute("data-theme", "dark");
    await choose(user, "Use light theme");
    expect(root).toHaveAttribute("data-theme", "light");
    await choose(user, "Match system theme");
    expect(root).not.toHaveAttribute("data-theme");
  });

  it("goes to each workspace page", async () => {
    const { user } = renderApp("/portfolio", makeState());
    await screen.findByRole("heading", { level: 1, name: "Portfolio" });

    for (const page of ["Review", "Outbox", "Calendar", "Library", "Settings", "Portfolio"]) {
      await choose(user, page);
      expect(await screen.findByRole("heading", { level: 1, name: page })).toBeInTheDocument();
    }
  }, 60_000);

  it("opens a project, its reports or its launch plan", async () => {
    const project = makeProject({ name: "Fieldnote", tagline: "" });
    const { user, router } = renderApp("/portfolio", makeState({ projects: [project] }));
    await screen.findByRole("heading", { level: 1, name: "Portfolio" });

    await choose(user, "Fieldnote — Launch plan");
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${project.id}/plan`));
    await choose(user, "Fieldnote — Reports");
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${project.id}/reports`));
    await choose(user, "Fieldnote");
    await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${project.id}`));
  }, 60_000);
});

describe("Top bar and navigation", () => {
  it("opens search from the top bar, and the shortcut closes it again", async () => {
    const { user } = renderApp("/portfolio", makeState());

    await user.click(await screen.findByRole("button", { name: /Search or run/ }));
    expect(await screen.findByRole("dialog", { name: "Search and run" })).toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Search and run" })).not.toBeInTheDocument());
  });

  it("switches the theme from the account menu and ticks the one in use", async () => {
    const { user } = renderApp("/portfolio", makeState());
    const account = await screen.findByRole("button", { name: /Jordan Avery/ });

    await user.click(account);
    await user.click(await screen.findByRole("menuitem", { name: "Dark" }));
    expect(root).toHaveAttribute("data-theme", "dark");

    await user.click(account);
    expect(await screen.findByRole("menuitem", { name: /^Dark/ })).toHaveTextContent("✓");
    await user.click(screen.getByRole("menuitem", { name: /^Light/ }));
    expect(root).toHaveAttribute("data-theme", "light");

    await user.click(account);
    await user.click(await screen.findByRole("menuitem", { name: /^Match system/ }));
    expect(root).not.toHaveAttribute("data-theme");
  });

  it("names the navigation's counts as separate words", async () => {
    const project = makeProject();
    const state = makeState({
      projects: [project],
      queue: [{ id: "queue-1", product_id: project.id, workflow_id: "blog", status: "pending", content: {}, preview: "", input_params: "", notes: "", created_at: new Date().toISOString() }],
      emails: [
        {
          id: "email-1", product_id: project.id, source_queue_id: null, recipient_name: "", recipient_email: "dana@synthweekly.example", subject: "Hello",
          body: "Hi", status: "pending", error: "", sent_at: null, created_at: new Date().toISOString(),
        },
      ],
    });
    renderApp("/portfolio", state);

    const rail = await screen.findByRole("navigation", { name: "Workspace" });
    expect(await within(rail).findByRole("link", { name: "Review 1 awaiting review" })).toBeInTheDocument();
    expect(await within(rail).findByRole("link", { name: "Outbox 1 unsent emails" })).toBeInTheDocument();
  });

  // On small screens the rail slides over the page; jsdom has no layout, so its open state shows as a class.
  it("opens the navigation on a small screen and closes it by tapping outside or navigating", async () => {
    const { user } = renderApp("/portfolio", makeState());
    const rail = await screen.findByRole("complementary", { name: "Main navigation" });
    expect(rail).not.toHaveClass("railOpen");

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(rail).toHaveClass("railOpen");
    await user.click(document.querySelector(".railScrim")!);
    expect(rail).not.toHaveClass("railOpen");

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    await user.click(within(rail).getByRole("link", { name: "Library" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(rail).not.toHaveClass("railOpen");
  });
});

describe("Capture dialog", () => {
  it("asks for a project first, since every idea belongs to one", async () => {
    const { user } = renderApp("/portfolio", makeState());

    await user.click(await screen.findByRole("button", { name: "Capture idea" }));
    const dialog = await screen.findByRole("dialog", { name: "Capture an idea" });

    expect(await within(dialog).findByText("Create a project first — every idea belongs to a project.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Idea")).not.toBeInTheDocument();
  });

  it("saves with Ctrl+Enter and links to the saved ideas", async () => {
    const project = makeProject();
    const state = makeState({ projects: [project] });
    const { user, router } = renderApp("/portfolio", state);

    await user.click(await screen.findByRole("button", { name: "Capture idea" }));
    const dialog = await screen.findByRole("dialog", { name: "Capture an idea" });
    await user.type(await within(dialog).findByLabelText("Idea"), "Testimonial clips{Control>}{Enter}{/Control}");

    await waitFor(() => expect(requestsTo(state, "POST", "/api/captures")[0]?.body).toEqual({ text: "Testimonial clips", product_id: project.id }));
    await user.click(await screen.findByRole("button", { name: "View ideas" }));

    expect(await screen.findByText("Testimonial clips")).toBeInTheDocument();
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe("/library?tab=ideas");
  });

  it("keeps the idea on screen when it can't be saved", async () => {
    const { user } = renderApp("/portfolio", makeState({ projects: [makeProject()] }));
    server.use(http.post(`${API}/api/captures`, () => HttpResponse.json({ detail: DATABASE_OUTAGE }, { status: 503 })));

    await user.click(await screen.findByRole("button", { name: "Capture idea" }));
    const dialog = await screen.findByRole("dialog", { name: "Capture an idea" });
    await user.type(await within(dialog).findByLabelText("Idea"), "Testimonial clips");
    await user.click(within(dialog).getByRole("button", { name: "Save idea" }));

    expect(await screen.findByText("Idea not saved")).toBeInTheDocument();
    expect(screen.getByText(DATABASE_OUTAGE)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Idea")).toHaveValue("Testimonial clips");
  });
});

describe("New project dialog", () => {
  it("counts the description toward readiness and shows why a project couldn't be created", async () => {
    const { user } = renderApp("/portfolio", makeState());
    server.use(http.post(`${API}/api/products`, () => HttpResponse.json({ detail: DATABASE_OUTAGE }, { status: 503 })));

    await user.click(await within(await screen.findByRole("navigation", { name: "Projects" })).findByRole("button", { name: "New project" }));
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    await user.type(within(dialog).getByLabelText("Name"), "Halcyon Studio");
    await user.type(within(dialog).getByLabelText(/Description/), "Booking software for recording studios.");
    expect(within(dialog).getByText("39 characters. 80 or more counts toward launch readiness.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Create project" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(DATABASE_OUTAGE);
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Halcyon Studio");
  });
});
