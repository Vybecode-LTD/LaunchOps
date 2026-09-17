import { expect, test } from "@playwright/test";
import { useFakeBackend } from "./support/fakeBackend";
import { sampleWorkspace } from "./support/workspace";

test("portfolio, project and report render from the production build", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  const { state } = sampleWorkspace();
  await useFakeBackend(page, state);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Portfolio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Launch board/ })).toBeVisible();
  await expect(page.getByText("T–11d").first()).toBeVisible();

  await page.getByRole("table").getByRole("link", { name: "VybeCode DSP" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /VybeCode DSP/ })).toBeVisible();

  await page.getByRole("link", { name: /^Reports/ }).click();
  await page.getByRole("link", { name: "Open market analysis" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Market analysis" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Revenue projections by scenario/ })).toBeVisible();

  // Fonts are bundled, not fetched from a third party.
  const fontFamily = await page.getByRole("heading", { level: 1, name: "Market analysis" }).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily).toContain("Mona Sans");
  expect(errors).toEqual([]);
});

test("dark theme applies from the account menu and persists", async ({ page }) => {
  await useFakeBackend(page, sampleWorkspace().state);
  await page.goto("/portfolio");
  await page.getByRole("button", { name: /Jordan Avery/ }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const background = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).toBe("rgb(12, 12, 16)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("navigation collapses into a menu on small screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useFakeBackend(page, sampleWorkspace().state);
  await page.goto("/portfolio");

  const nav = page.getByRole("complementary", { name: "Main navigation" });
  await expect(nav).not.toBeInViewport();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(nav).toBeInViewport();
  await nav.getByRole("link", { name: "Calendar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendar" })).toBeVisible();
  await expect(nav).not.toBeInViewport();
});
