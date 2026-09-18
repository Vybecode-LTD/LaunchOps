import { describe, expect, it } from "vitest";
import type { Project, QueueItem, QueueStatus } from "@/lib/api/types";
import { ALWAYS_AVAILABLE, PLAYBOOK, playbook } from "./playbook";
import { OPERATIONS } from "./operations";

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

function queued(workflow_id: string, status: QueueStatus, product_id = "p1"): QueueItem {
  return {
    id: `${workflow_id}-${status}`,
    product_id,
    workflow_id,
    status,
    content: {},
    preview: "",
    input_params: "",
    notes: "",
    created_at: "2026-09-10T00:00:00Z",
  } as QueueItem;
}

const TODAY = "2026-09-17";

describe("the playbook's shape", () => {
  it("accounts for every operation in the catalogue exactly once", () => {
    // A stage list that quietly drops an operation would hide it from anyone following the
    // playbook rather than the catalogue.
    const staged = PLAYBOOK.flatMap((stage) => stage.operations);
    const accounted = [...staged, ...ALWAYS_AVAILABLE];
    expect([...accounted].sort()).toEqual([...OPERATIONS.map((operation) => operation.id)].sort());
    expect(new Set(accounted).size).toBe(accounted.length);
  });

  it("keeps tools out of the sequence, because their use cannot be observed", () => {
    // A tool returns its result directly and stores nothing, so counting it would leave the
    // playbook permanently one step from finished.
    for (const id of ALWAYS_AVAILABLE) {
      expect(OPERATIONS.find((operation) => operation.id === id)?.kind).toBe("tool");
      expect(PLAYBOOK.flatMap((stage) => stage.operations)).not.toContain(id);
    }
  });

  it("only builds on stages that come before it", () => {
    const seen = new Set<string>();
    for (const stage of PLAYBOOK) {
      for (const earlier of stage.builtOn) expect(seen.has(earlier)).toBe(true);
      seen.add(stage.id);
    }
  });

  it("opens its stages in a sensible order as launch approaches", () => {
    const windows = PLAYBOOK.map((stage) => stage.startsAtDaysBefore).filter((days): days is number => days !== null);
    expect(windows).toEqual([...windows].sort((a, b) => b - a));
  });
});

describe("what to run next", () => {
  it("starts a fresh project at the first stage and names one operation", () => {
    const { current, recommended, done } = playbook(project(), [], TODAY);

    expect(done).toBe(0);
    expect(current?.stage.id).toBe("understand");
    expect(recommended?.operation.id).toBe("market_analysis");
    expect(recommended?.stage.id).toBe("understand");
  });

  it("moves past an operation whose report is saved", () => {
    const { current, recommended } = playbook(project({ market_analysis: { executive_summary: "done" } }), [], TODAY);

    expect(current?.stage.id).toBe("understand");
    expect(recommended?.operation.id).toBe("competitor");
  });

  it("counts a result still awaiting review, so it does not ask for the work twice", () => {
    const { recommended } = playbook(project(), [queued("competitor", "pending")], TODAY);

    // market_analysis is still outstanding, so it is next — but competitor is not asked for again.
    expect(recommended?.operation.id).toBe("market_analysis");
    const understand = playbook(project(), [queued("competitor", "pending")], TODAY).stages[0]!;
    expect(understand.operations.find((entry) => entry.operation.id === "competitor")?.state).toBe("in_review");
    expect(understand.done).toBe(1);
  });

  it("shows a first run as running, and does not ask for it again meanwhile", () => {
    // Only a first run with nothing finished beside it reports `running`; completion wins otherwise.
    const { stages, recommended } = playbook(project(), [queued("market_analysis", "running")], TODAY);

    expect(stages[0]!.operations.find((entry) => entry.operation.id === "market_analysis")?.state).toBe("running");
    expect(recommended?.operation.id).toBe("competitor");
  });

  it("keeps a finished operation finished while it is run again", () => {
    // Running an operation again adds a new `running` result and keeps the approved one. If
    // `running` won, a stage the user had already finished would reopen the moment they re-ran
    // something in it, and the recommendation for the next stage would disappear.
    const queue = [queued("competitor", "approved"), { ...queued("competitor", "running"), id: "competitor-rerun" }];

    const understand = playbook(project(), queue, TODAY).stages[0]!;

    expect(understand.operations.find((entry) => entry.operation.id === "competitor")?.state).toBe("done");
    expect(understand.done).toBe(1);
  });

  it("counts a result awaiting review even while the operation is run again", () => {
    const queue = [queued("competitor", "pending"), { ...queued("competitor", "running"), id: "competitor-rerun" }];

    const understand = playbook(project(), queue, TODAY).stages[0]!;

    expect(understand.operations.find((entry) => entry.operation.id === "competitor")?.state).toBe("in_review");
  });

  it("moves on to the next stage when a finished one has a rerun in progress", () => {
    const finished = project({ market_analysis: { executive_summary: "Growing." }, pricing_result: { launch_strategy: "Undercut." } });
    const queue = [
      queued("competitor", "approved"),
      queued("trend", "approved"),
      { ...queued("trend", "running"), id: "trend-rerun" },
    ];

    const { current, recommended } = playbook(finished, queue, TODAY);

    expect(current?.stage.id).toBe("position");
    expect(recommended?.stage.id).toBe("position");
  });

  it("asks again for an operation that failed", () => {
    const { recommended } = playbook(project({ market_analysis: { executive_summary: "done" } }), [queued("competitor", "failed")], TODAY);

    expect(recommended?.operation.id).toBe("competitor");
  });

  it("does not count a result belonging to another project", () => {
    const { done } = playbook(project(), [queued("competitor", "approved", "somewhere-else")], TODAY);

    expect(done).toBe(0);
  });

  it("recommends nothing once every stage is finished", () => {
    const queue = OPERATIONS.filter((operation) => operation.kind !== "tool").map((operation) => queued(operation.id, "approved"));
    const reports = {
      market_analysis: { executive_summary: "Growing." },
      pricing_result: { launch_strategy: "Undercut." },
      press_kit: { boilerplate: "Halcyon builds things." },
      press_release: { headline: "Halcyon launches" },
      seo_result: { current_score: 60 },
    };

    const { current, recommended, done, total } = playbook(project(reports), queue, TODAY);

    expect(done).toBe(total);
    expect(current).toBeNull();
    expect(recommended).toBeNull();
  });
});

describe("timing and groundwork", () => {
  it("marks the current stage behind once its window has already opened", () => {
    // Launch is 10 days away; "Understand the market" was meant to be underway at 45.
    const soon = playbook(project({ launch_date: "2026-09-27" }), [], TODAY);
    expect(soon.current?.status).toBe("behind");

    const plenty = playbook(project({ launch_date: "2027-06-01" }), [], TODAY);
    expect(plenty.current?.status).toBe("current");
  });

  it("does not call a stage behind when there is no launch date to be behind", () => {
    expect(playbook(project(), [], TODAY).current?.status).toBe("current");
  });

  it("names the unfinished groundwork a stage reads, without blocking it", () => {
    const stages = playbook(project(), [], TODAY).stages;
    const position = stages.find((entry) => entry.stage.id === "position")!;

    expect(position.missingGroundwork).toEqual(["Understand the market"]);
    // Still listed and still runnable — the playbook advises, it does not gate.
    expect(position.operations.length).toBeGreaterThan(0);
  });

  it("drops the groundwork note once the earlier stage is finished", () => {
    const finished = project({ market_analysis: { executive_summary: "Growing." }, pricing_result: { launch_strategy: "Undercut." } });
    const queue = [queued("competitor", "approved"), queued("trend", "approved")];

    const stages = playbook(finished, queue, TODAY).stages;

    expect(stages.find((entry) => entry.stage.id === "understand")?.status).toBe("complete");
    expect(stages.find((entry) => entry.stage.id === "position")?.missingGroundwork).toEqual([]);
  });
});
