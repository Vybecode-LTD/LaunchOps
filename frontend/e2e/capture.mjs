// Full-page screenshots of every main route, for visual review.
// Usage: node e2e/capture.mjs <outDir> <token> [baseUrl]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [outDir, token, baseUrl = "http://localhost:5173"] = process.argv.slice(2);
if (!outDir || !token) {
  console.error("usage: node e2e/capture.mjs <outDir> <token> [baseUrl]");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const results = [];

async function capture(theme, routes) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, deviceScaleFactor: 1 });
  await context.addInitScript((t) => localStorage.setItem("launchops_token", t), token);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("response", (res) => res.status() >= 400 && errors.push(`${res.status()} ${res.url()}`));

  const projectsRes = await page.request.get(`${baseUrl}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
  const projects = await projectsRes.json();
  const vybe = projects.find((p) => p.name === "VybeCode DSP");
  const orbit = projects.find((p) => p.name === "Orbit Payroll");

  for (const [name, path] of routes({ vybe: vybe.id, orbit: orbit.id })) {
    errors.length = 0;
    await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const file = join(outDir, `${theme}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    results.push({ theme, name, errors: [...errors] });
  }
  await context.close();
}

const allRoutes = ({ vybe, orbit }) => [
  ["portfolio", "/portfolio"],
  ["overview", `/projects/${vybe}`],
  ["operations", `/projects/${vybe}/operations`],
  ["run-market", `/projects/${vybe}/operations?run=market_analysis`],
  ["reports", `/projects/${vybe}/reports`],
  ["report-market", `/projects/${vybe}/reports/market-analysis`],
  ["report-seo", `/projects/${vybe}/reports/seo`],
  ["report-release", `/projects/${orbit}/reports/press-release`],
  ["review", `/projects/${vybe}/review`],
  ["outbox", "/outbox"],
  ["plan", `/projects/${vybe}/plan`],
  ["project-settings", `/projects/${vybe}/settings`],
  ["calendar", "/calendar"],
  ["library", "/library"],
  ["settings-voice", "/settings/voice"],
  ["settings-team", "/settings/team"],
];

const theme = process.env.THEME;
if (!theme || theme === "light") await capture("light", allRoutes);
if (!theme || theme === "dark") await capture("dark", (ids) => allRoutes(ids).filter(([n]) => ["portfolio", "overview", "report-market", "review", "outbox"].includes(n)));

await browser.close();
for (const r of results) console.log(`${r.theme}/${r.name}: ${r.errors.length ? r.errors.join(" | ") : "ok"}`);
