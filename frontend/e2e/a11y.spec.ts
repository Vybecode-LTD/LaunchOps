import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { useFakeBackend } from "./support/fakeBackend";
import { SAMPLE_INVITATION_TOKEN, SAMPLE_RESET_TOKEN, sampleWorkspace } from "./support/workspace";

/**
 * Automated WCAG 2.2 A/AA checks (axe-core) on every screen, in both themes,
 * with the sample workspace loaded so tables, charts and dialogs are populated.
 * Automated checks catch roughly half of accessibility problems; keyboard and
 * screen-reader passes are still needed before a release.
 */

type Workspace = ReturnType<typeof sampleWorkspace>;
type Ids = Workspace["projects"];

const SCREENS: Array<{
  name: string;
  path: (p: Ids, queue: Workspace["queue"]) => string;
  signedIn?: boolean;
  ready?: "dialog";
  /** A section that must be on screen before the scan, e.g. one that renders once its data arrives. */
  section?: RegExp;
}> = [
  { name: "Sign in", path: () => "/login", signedIn: false },
  { name: "Forgot password", path: () => "/forgot-password", signedIn: false },
  { name: "Reset password", path: () => `/reset-password/${SAMPLE_RESET_TOKEN}`, signedIn: false },
  { name: "Invitation", path: () => `/invite/${SAMPLE_INVITATION_TOKEN}`, signedIn: false },
  { name: "Portfolio", path: () => "/portfolio" },
  { name: "Project overview", path: (p) => `/projects/${p.vybe.id}` },
  { name: "Operations", path: (p) => `/projects/${p.vybe.id}/operations` },
  { name: "Run sheet", path: (p) => `/projects/${p.vybe.id}/operations?run=market_analysis`, ready: "dialog" },
  { name: "Reports", path: (p) => `/projects/${p.vybe.id}/reports` },
  { name: "Market analysis report", path: (p) => `/projects/${p.vybe.id}/reports/market-analysis`, section: /^Sources/ },
  { name: "SEO report", path: (p) => `/projects/${p.vybe.id}/reports/seo` },
  { name: "Review", path: (p) => `/projects/${p.vybe.id}/review` },
  {
    name: "Research result with sources",
    path: (p, queue) => `/projects/${p.vybe.id}/review/${queue.find((item) => item.workflow_id === "competitor")!.id}`,
    section: /^Sources/,
  },
  { name: "Outbox", path: () => "/outbox" },
  { name: "Launch plan", path: (p) => `/projects/${p.vybe.id}/plan` },
  { name: "Project settings", path: (p) => `/projects/${p.vybe.id}/settings` },
  { name: "Calendar month", path: () => "/calendar" },
  { name: "Calendar week", path: () => "/calendar?view=week" },
  { name: "Library", path: () => "/library" },
  { name: "Workspace settings", path: () => "/settings" },
  { name: "Brand voice", path: () => "/settings/voice" },
  { name: "Companies", path: () => "/settings/companies" },
  { name: "Channels", path: () => "/settings/channels" },
  { name: "Organisation settings", path: () => "/settings/organisation" },
  { name: "Activity", path: () => "/settings/activity" },
  { name: "Usage", path: () => "/settings/usage" },
  { name: "Team", path: () => "/settings/team" },
];

test.use({ contextOptions: { reducedMotion: "reduce" } });

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const screen of SCREENS) {
      test(`${screen.name} meets WCAG A/AA automated checks`, async ({ page }) => {
        const { state, projects, queue } = sampleWorkspace();
        await useFakeBackend(page, state, { signedIn: screen.signedIn ?? true });
        await page.goto(screen.path(projects, queue));
        // An open dialog hides the page behind it from assistive tech, so wait for whichever is on top.
        if (screen.ready === "dialog") await expect(page.getByRole("dialog")).toBeVisible();
        else await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        if (screen.section) await expect(page.getByRole("region", { name: screen.section })).toBeVisible();
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

        const violations = results.violations.map((v) => ({
          rule: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 5).map((n) => ({
            target: n.target.join(" "),
            detail: n.any[0]?.message ?? n.failureSummary,
          })),
        }));
        expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
      });
    }
  });
}
