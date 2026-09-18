import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { addDays, formatDateKey } from "../src/lib/domain/dates";
import { requestsTo, useFakeBackend } from "./support/fakeBackend";
import { sampleWorkspace } from "./support/workspace";

/**
 * The main task on each screen, in the production build, in a real browser.
 * Assertions check what reached the API, not just what the page shows.
 */

test("sign in returns to the page that was asked for", async ({ page }) => {
  const { state } = sampleWorkspace();
  await useFakeBackend(page, state, { signedIn: false });
  await page.goto("/calendar");

  await page.getByLabel("Email").fill("jordan@northstar.example");
  await page.getByLabel("Password", { exact: true }).fill("correct-horse");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("launchops_token"))).toBe("token-1");
});

test("portfolio: create a project and land on its overview", async ({ page }) => {
  const { state } = sampleWorkspace();
  await useFakeBackend(page, state);
  await page.goto("/portfolio");

  await page.getByRole("main").getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel("Name").fill("Northwind Analytics");
  await dialog.getByLabel(/Tagline/).fill("Dashboards for field teams");
  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(page.getByRole("heading", { level: 1, name: /Northwind Analytics/ })).toBeVisible();
  expect(requestsTo(state, "POST", "/api/products")[0]?.body).toMatchObject({ name: "Northwind Analytics", tagline: "Dashboards for field teams" });
});

test("operations: run a workflow with instructions", async ({ page }) => {
  const { state, projects } = sampleWorkspace();
  await useFakeBackend(page, state);
  await page.goto(`/projects/${projects.vybe.id}/operations?run=competitor`);

  await page.getByLabel(/Instructions/).fill("Focus on tools for producers");
  await page.getByRole("button", { name: "Run competitor deep-dive" }).click();

  // exact: Radix also renders a hidden live-region copy of the toast text while announcing it.
  await expect(page.getByText("Competitor deep-dive started", { exact: true })).toBeVisible();
  expect(requestsTo(state, "POST", "/api/workflows/launch")[0]?.body).toEqual({
    product_id: projects.vybe.id,
    workflow_id: "competitor",
    instructions: "Focus on tools for producers",
  });
});

test("command palette: open an operation on the current project", async ({ page }) => {
  const { state, projects } = sampleWorkspace();
  await useFakeBackend(page, state);
  await page.goto(`/projects/${projects.vybe.id}`);
  await expect(page.getByRole("heading", { level: 1, name: /VybeCode DSP/ })).toBeVisible();

  await page.keyboard.press("Control+K");
  await page.getByPlaceholder("Search projects, pages and operations…").fill("pricing strategy");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`/projects/${projects.vybe.id}/operations\\?run=pricing$`));
  await expect(page.getByRole("button", { name: "Run pricing strategy" })).toBeVisible();
});

test("review: move through results with the keyboard and approve one", async ({ page }) => {
  const { state, projects, queue } = sampleWorkspace();
  const [, outreach, competitor] = queue;
  await useFakeBackend(page, state);
  await page.goto(`/projects/${projects.vybe.id}/review`);

  await expect(page).toHaveURL(new RegExp(`/review/${outreach!.id}`));
  await page.keyboard.press("j");
  await expect(page).toHaveURL(new RegExp(`/review/${competitor!.id}`));
  await expect(page.getByRole("img", { name: "Threat level 7 of 10" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect.poll(() => requestsTo(state, "PATCH", `/api/queue/${competitor!.id}`).map((r) => r.body)).toEqual([{ status: "approved", notes: "" }]);
});

test("outbox: send selected drafts only after confirming recipients and sender", async ({ page }) => {
  const { state, emails } = sampleWorkspace();
  await useFakeBackend(page, state);
  await page.goto("/outbox");

  await page.getByLabel("Select all sendable drafts").check();
  await page.getByRole("button", { name: "Send 2 selected" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Send 2 emails?" });
  await expect(dialog.getByText("dana@synthweekly.example")).toBeVisible();
  await expect(dialog.getByText("priya@mixdown.example")).toBeVisible();
  expect(requestsTo(state, "POST", "/api/email-queue")).toEqual([]);

  await dialog.getByRole("button", { name: "Send 2 emails" }).click();
  await expect(page.getByText("2 emails sent", { exact: true })).toBeVisible();
  expect(requestsTo(state, "POST", "/api/email-queue").map((r) => r.path).sort()).toEqual(
    [`/api/email-queue/${emails[0]!.id}/send`, `/api/email-queue/${emails[1]!.id}/send`].sort(),
  );
});

test("launch plan: ticking an item saves the checklist", async ({ page }) => {
  const { state, projects } = sampleWorkspace();
  await useFakeBackend(page, state);
  await page.goto(`/projects/${projects.vybe.id}/plan`);

  // Click and then assert, rather than `.check()`. A launch plan tick is a controlled checkbox:
  // the click toggles it natively and React then re-renders it from the query cache, so the state
  // Playwright reads immediately after the click is not guaranteed to be the settled one when the
  // machine is loaded. `.check()` throws at once in that window ("Clicking the checkbox did not
  // change its state") instead of retrying, which made this test fail intermittently in CI while
  // the save itself was always sent correctly. `toBeChecked()` retries, and the PATCH assertion
  // below still proves the tick was saved.
  const item = page.getByLabel("Beta testers recruited");
  await item.click();
  await expect(item).toBeChecked();

  await expect.poll(() => requestsTo(state, "PATCH", `/api/products/${projects.vybe.id}/checklist`).at(-1)?.body).toMatchObject({ "Pre-Launch_5": true, "Pre-Launch_0": true });
});

test("calendar: drag an entry to another day, then undo", async ({ page }) => {
  const { state, today, calendar } = sampleWorkspace();
  const entry = calendar[0]!;
  const target = addDays(today, 2);
  await useFakeBackend(page, state);
  await page.goto("/calendar");

  const cell = (date: string) => page.getByRole("button", { name: new RegExp(`^${formatDateKey(date, "long")}`) }).locator("..");
  await cell(entry.date).getByText(entry.title).dragTo(cell(target));

  await expect(cell(target).getByText(entry.title)).toBeVisible();
  await expect.poll(() => requestsTo(state, "PATCH", `/api/calendar/${entry.id}`).map((r) => r.body)).toEqual([{ date: target }]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(cell(entry.date).getByText(entry.title)).toBeVisible();
  await expect.poll(() => requestsTo(state, "PATCH", `/api/calendar/${entry.id}`).map((r) => r.body)).toEqual([{ date: target }, { date: entry.date }]);
});

test("reports: download a report as Markdown", async ({ page }) => {
  const { state, projects } = sampleWorkspace();
  await useFakeBackend(page, state);
  await page.goto(`/projects/${projects.vybe.id}/reports/market-analysis`);
  await expect(page.getByRole("img", { name: /Revenue projections by scenario/ })).toBeVisible();

  await page.getByRole("button", { name: /Export/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download Markdown" }).click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/\.md$/);
  const markdown = await readFile(await file.path(), "utf8");
  expect(markdown).toContain("# Market analysis — VybeCode DSP");
  expect(markdown).toContain("PatchForge");
  // The report ends with the pages its research relied on, addresses included.
  expect(markdown).toMatch(/## Sources\n\n1\. PatchForge pricing and plans — https:\/\/patchforge\.example\/pricing \(updated September 2, 2026\)\n[\s\S]*3\. KnobWorks: build effects without code — https:\/\/knobworks\.example\/\n$/);
});

test("reports: a printed report lists each source's address", async ({ page }) => {
  const { state, projects } = sampleWorkspace();
  await useFakeBackend(page, state);
  await page.goto(`/projects/${projects.vybe.id}/reports/market-analysis`);
  const sources = page.getByRole("region", { name: /^Sources/ });
  const address = sources.getByText("https://patchforge.example/pricing", { exact: true });

  // On screen the title links to the page, so the address isn't repeated.
  await expect(sources.getByRole("link", { name: "PatchForge pricing and plans" })).toBeVisible();
  await expect(address).toBeHidden();

  // On paper a link can't be followed, so the address is printed.
  await page.emulateMedia({ media: "print" });
  await expect(address).toBeVisible();
  await expect(sources.getByText("https://knobworks.example/", { exact: true })).toBeVisible();
});

test("library: save a template that operations will offer", async ({ page }) => {
  const { state } = sampleWorkspace();
  await useFakeBackend(page, state);
  await page.goto("/library");

  await page.getByRole("button", { name: "New", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New template" });
  await dialog.getByLabel("Name").fill("Podcast pitch");
  await dialog.getByLabel("Tags").pressSequentially("outreach,podcast,");
  await dialog.getByLabel("Content").fill("Hi {host}, ...");
  await dialog.getByRole("button", { name: "Save template" }).click();

  await expect.poll(() => requestsTo(state, "POST", "/api/templates")[0]?.body).toMatchObject({ name: "Podcast pitch", tags: ["outreach", "podcast"], content: "Hi {host}, ..." });
});

test("settings: saving the brand voice keeps everything else", async ({ page }) => {
  const { state } = sampleWorkspace();
  const platforms = structuredClone(state.settings.platforms);
  await useFakeBackend(page, state);
  await page.goto("/settings/voice");

  await page.getByLabel("Brand name").fill("Northstar Labs");
  await page.getByRole("region", { name: "Brand voice" }).getByRole("button", { name: "Save" }).click();

  await expect.poll(() => (requestsTo(state, "PUT", "/api/settings")[0]?.body as typeof state.settings | undefined)?.brand.name).toBe("Northstar Labs");
  const saved = requestsTo(state, "PUT", "/api/settings")[0]!.body as typeof state.settings;
  expect(saved.brand.company_name).toBe("Northstar Ventures");
  expect(saved.platforms).toEqual(platforms);
});
