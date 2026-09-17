import { describe, expect, it } from "vitest";
import { PLAN_PHASES, addCustomItem, launchDayClock, phaseItems, planProgress, removeCustomItem, setChecked } from "./checklist";

const preLaunch = PLAN_PHASES[0]!;
const launchDay = PLAN_PHASES[1]!;

describe("phaseItems", () => {
  it("keys items by phase and index, the stored format", () => {
    const items = phaseItems({ "Pre-Launch_0": true }, preLaunch);
    expect(items).toHaveLength(15);
    expect(items[0]).toMatchObject({ key: "Pre-Launch_0", checked: true, custom: false });
  });

  it("splits launch-day times onto a 24-hour clock", () => {
    const items = phaseItems({}, launchDay);
    expect(items[0]).toMatchObject({ time: "08:00", label: "Final pre-flight checks" });
    expect(items[9]).toMatchObject({ time: "14:00", label: "Share social proof / reactions" });
    expect(items[10]).toMatchObject({ time: "17:00", label: "End-of-day check-in post" });
  });

  it("appends custom items after the built-in ones", () => {
    const items = phaseItems({ "_custom_Pre-Launch": ["Record demo"], "Pre-Launch_15": true }, preLaunch);
    expect(items[15]).toMatchObject({ key: "Pre-Launch_15", label: "Record demo", custom: true, customIndex: 0, checked: true });
  });
});

describe("launchDayClock", () => {
  it("treats hours before 8 as afternoon", () => {
    expect(launchDayClock(8, "00")).toBe("08:00");
    expect(launchDayClock(12, "00")).toBe("12:00");
    expect(launchDayClock(2, "30")).toBe("14:30");
  });
});

describe("planProgress", () => {
  it("counts only real items — custom-item arrays and stale keys don't inflate it", () => {
    const checklist = {
      "Pre-Launch_0": true,
      "_custom_Pre-Launch": ["A"],
      "Pre-Launch_15": true,
      "Pre-Launch_99": true,
      "Launch Day_0": false,
    };
    expect(planProgress(checklist)).toEqual({ done: 2, total: 34 });
  });
});

describe("custom items", () => {
  it("adds trimmed items and ignores blank ones", () => {
    const one = addCustomItem({}, "Pre-Launch", "  Brief testers  ");
    expect(one["_custom_Pre-Launch"]).toEqual(["Brief testers"]);
    expect(addCustomItem(one, "Pre-Launch", "   ")).toBe(one);
  });

  it("keeps each remaining item's tick when an earlier custom item is removed", () => {
    const checklist = {
      "_custom_Pre-Launch": ["A", "B", "C"],
      "Pre-Launch_15": true, // A
      "Pre-Launch_16": false, // B
      "Pre-Launch_17": true, // C
    };
    const next = removeCustomItem(checklist, preLaunch, 0);
    expect(next["_custom_Pre-Launch"]).toEqual(["B", "C"]);
    const items = phaseItems(next, preLaunch).slice(15);
    expect(items.map((i) => [i.label, i.checked])).toEqual([
      ["B", false],
      ["C", true],
    ]);
    expect(next["Pre-Launch_17"]).toBeUndefined();
  });

  it("ignores an out-of-range index", () => {
    const checklist = { "_custom_Pre-Launch": ["A"] };
    expect(removeCustomItem(checklist, preLaunch, 3)).toBe(checklist);
  });

  it("setChecked returns a new object", () => {
    const before = { "Pre-Launch_0": false };
    const after = setChecked(before, "Pre-Launch_0", true);
    expect(after).not.toBe(before);
    expect(after["Pre-Launch_0"]).toBe(true);
  });
});
