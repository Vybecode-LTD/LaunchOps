import { describe, expect, it } from "vitest";
import type { Project } from "@/lib/api/types";
import {
  cleanDescription,
  describeDays,
  hasReport,
  launchState,
  projectType,
  readiness,
  swatchColor,
  tMinus,
} from "./projects";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Halcyon",
    tagline: "",
    url: "",
    color: "#0f8b8d",
    status: "pre_launch",
    description: "",
    keywords: [],
    checklist: {},
    email_settings: {},
    company_details: {},
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("projectType", () => {
  it("prefers the stored project_type", () => {
    expect(projectType({ project_type: "service", description: "[PERSONA] x" })).toBe("service");
  });

  it("reads the legacy description prefix", () => {
    expect(projectType({ project_type: null, description: "[PERSONA] A podcast" })).toBe("persona");
    expect(cleanDescription("[SERVICE] Design studio")).toBe("Design studio");
  });

  it("defaults to product", () => {
    expect(projectType({ description: "No prefix" })).toBe("product");
  });
});

describe("swatchColor", () => {
  it("maps the old neon palette to the current swatches", () => {
    expect(swatchColor("#00f0ff")).toBe("#0f8b8d");
    expect(swatchColor("#A855F7")).toBe("#7654d8");
  });

  it("keeps valid colors and replaces invalid ones", () => {
    expect(swatchColor("#123456")).toBe("#123456");
    expect(swatchColor("javascript:alert(1)")).toBe("#0f8b8d");
  });
});

describe("hasReport", () => {
  it("counts a structured report", () => {
    expect(hasReport({ tiers: [], generated_at: "x" })).toBe(true);
  });

  it("does not count empty, unparsed or failed results", () => {
    expect(hasReport(null)).toBe(false);
    expect(hasReport({ generated_at: "x", source_url: "https://a.example" })).toBe(false);
    expect(hasReport({ raw_response: "text" })).toBe(false);
    expect(hasReport({ error: "boom" })).toBe(false);
  });
});

describe("readiness", () => {
  it("is zero for an empty project", () => {
    expect(readiness(project()).score).toBe(0);
  });

  it("weights plan 50, reports 30 and profile 20", () => {
    const checklist: Record<string, boolean> = {};
    for (let i = 0; i < 15; i += 1) checklist[`Pre-Launch_${i}`] = true; // 15 of 33 items
    for (let i = 0; i < 11; i += 1) checklist[`Launch Day_${i}`] = true; // 26 of 33
    const p = project({
      checklist,
      url: "https://halcyon.example",
      description: "x".repeat(80),
      keywords: ["design"],
      company_details: { company_name: "Halcyon Ltd" },
      launch_date: "2026-10-01",
      press_kit: { boilerplate: "b" },
      pricing_result: { tiers: [] },
    });
    const r = readiness(p);
    expect(r.plan).toEqual({ done: 26, total: 33 });
    // 50 × 26/33 + 30 × 2/5 + 20 × 5/5 = 39.39 + 12 + 20 = 71.39 → 71
    expect(r.score).toBe(71);
    expect(r.assets.filter((a) => a.done).map((a) => a.id)).toEqual(["pricing_result", "press_kit"]);
    expect(r.profile.every((c) => c.done)).toBe(true);
  });

  it("requires 80 characters after removing a legacy prefix", () => {
    const r = readiness(project({ description: `[PRODUCT] ${"x".repeat(79)}` }));
    expect(r.profile.find((c) => c.id === "description")?.done).toBe(false);
  });

  it("accepts an assigned company in place of company details", () => {
    const r = readiness(project({ brand_id: "b1" }));
    expect(r.profile.find((c) => c.id === "company")?.done).toBe(true);
  });
});

describe("launchState", () => {
  const today = "2026-09-14";

  it("is launched for launched and post-launch projects, whatever the date", () => {
    expect(launchState(project({ status: "launched", launch_date: "2026-01-01" }), 0, today)).toBe("launched");
    expect(launchState(project({ status: "post_launch" }), 0, today)).toBe("launched");
  });

  it("is unscheduled without a launch date", () => {
    expect(launchState(project(), 90, today)).toBe("unscheduled");
  });

  it("is overdue when the date has passed", () => {
    expect(launchState(project({ launch_date: "2026-09-13" }), 100, today)).toBe("overdue");
  });

  it("is at risk within 14 days below 70 readiness, including launch day", () => {
    expect(launchState(project({ launch_date: "2026-09-28" }), 69, today)).toBe("at_risk");
    expect(launchState(project({ launch_date: "2026-09-14" }), 10, today)).toBe("at_risk");
  });

  it("is on track at 70, or further than 14 days out", () => {
    expect(launchState(project({ launch_date: "2026-09-28" }), 70, today)).toBe("on_track");
    expect(launchState(project({ launch_date: "2026-09-29" }), 0, today)).toBe("on_track");
  });
});

describe("tMinus", () => {
  it("formats before, on and after launch day", () => {
    expect(tMinus(12)).toBe("T–12d");
    expect(tMinus(0)).toBe("T–0");
    expect(tMinus(-3)).toBe("T+3d");
    expect(tMinus(null)).toBe("—");
  });

  it("describes days in words", () => {
    expect(describeDays(1)).toBe("Launches tomorrow");
    expect(describeDays(-1)).toBe("Launch date was yesterday");
    expect(describeDays(-4)).toBe("Launch date was 4 days ago");
  });
});
