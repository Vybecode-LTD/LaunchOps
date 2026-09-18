import { expect, test } from "@playwright/test";
import { useFakeBackend } from "./support/fakeBackend";
import { SAMPLE_INVITATION_TOKEN, SAMPLE_RESET_TOKEN, sampleWorkspace } from "./support/workspace";

/**
 * Every screen must fit the width of a phone.
 *
 * A page that scrolls sideways is the most visible responsive defect there is, and the
 * accessibility scans cannot see it: they run at the default desktop viewport, so three
 * screens shipped overflowing by ~135px without anything failing. The causes were subtle
 * — an auto-layout table whose intrinsic width leaked past the wrapper clipping it, and a
 * segmented control whose flex items could not shrink — so this measures the symptom
 * (document wider than viewport) rather than any particular cause.
 */

type Workspace = ReturnType<typeof sampleWorkspace>;
type Ids = Workspace["projects"];

const SCREENS: Array<{
  name: string;
  path: (p: Ids, queue: Workspace["queue"]) => string;
  signedIn?: boolean;
  ready?: "dialog";
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
  { name: "Market analysis report", path: (p) => `/projects/${p.vybe.id}/reports/market-analysis` },
  { name: "SEO report", path: (p) => `/projects/${p.vybe.id}/reports/seo` },
  { name: "Review", path: (p) => `/projects/${p.vybe.id}/review` },
  {
    name: "Research result with sources",
    path: (p, queue) => `/projects/${p.vybe.id}/review/${queue.find((item) => item.workflow_id === "competitor")!.id}`,
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

// 390px is an iPhone 15/16 in portrait — the narrowest mainstream phone worth supporting.
const PHONE = { width: 390, height: 844 };

test.use({ viewport: PHONE, contextOptions: { reducedMotion: "reduce" } });

for (const screen of SCREENS) {
  test(`${screen.name} fits a ${PHONE.width}px viewport`, async ({ page }) => {
    const { state, projects, queue } = sampleWorkspace();
    await useFakeBackend(page, state, { signedIn: screen.signedIn ?? true });
    await page.goto(screen.path(projects, queue));
    if (screen.ready === "dialog") await expect(page.getByRole("dialog").first()).toBeVisible();
    else await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => {});

    const { scrollWidth, clientWidth, widest } = await page.evaluate(() => {
      const de = document.documentElement;
      let widest = "";
      if (de.scrollWidth > de.clientWidth + 1) {
        // Name the element whose removal would fix it, so a failure says where to look.
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.right <= de.clientWidth + 1) continue;
          const previous = el.style.display;
          el.style.display = "none";
          const fixed = de.scrollWidth <= de.clientWidth + 1;
          el.style.display = previous;
          if (fixed) widest = `${el.tagName.toLowerCase()}.${String(el.className || "").split(/\s+/)[0]}`;
        }
      }
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, widest };
    });

    expect(
      scrollWidth,
      widest ? `${screen.name} scrolls sideways; the overflow comes from ${widest}` : `${screen.name} scrolls sideways`,
    ).toBeLessThanOrEqual(clientWidth + 1);
  });
}
