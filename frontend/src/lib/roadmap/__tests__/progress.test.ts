import { describe, expect, it } from "vitest";

import {
  nextNodeId,
  sanitizeStatuses,
  selectTrackedRoadmaps,
  statusesFor,
  summarize,
} from "@/lib/roadmap/progress";
import type { ProgressState } from "@/types/roadmap";
import { makeRoadmap, topic } from "./fixtures";

describe("summarize", () => {
  const roadmap = makeRoadmap([
    topic("a"),
    topic("b"),
    topic("c"),
    topic("d"),
    { id: "sec", kind: "section", lane: "spine", label: "Section" },
    { id: "info", kind: "info", lane: "spine", label: "Info" },
    { id: "link", kind: "roadmapLink", lane: "right", label: "Link", linkTo: "x" },
  ]);

  it("counts only topic nodes (ignores section/info/link)", () => {
    const summary = summarize(roadmap, {});
    expect(summary.total).toBe(4);
    expect(summary.denominator).toBe(4);
  });

  it("computes percent = done / (total - skipped)", () => {
    // 2 done, 1 skipped → denominator 3 → 2/3 → 67%
    const summary = summarize(roadmap, { a: "done", b: "done", c: "skipped" });
    expect(summary.done).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.denominator).toBe(3);
    expect(summary.percent).toBe(67);
  });

  it("handles divide-by-zero when every topic is skipped", () => {
    const summary = summarize(roadmap, {
      a: "skipped",
      b: "skipped",
      c: "skipped",
      d: "skipped",
    });
    expect(summary.denominator).toBe(0);
    expect(summary.percent).toBe(0);
  });

  it("returns 0% when nothing is done", () => {
    expect(summarize(roadmap, {}).percent).toBe(0);
  });

  it("counts learning separately and reaches 100% when all remaining are done", () => {
    const summary = summarize(roadmap, {
      a: "done",
      b: "done",
      c: "done",
      d: "learning",
    });
    expect(summary.learning).toBe(1);
    expect(summary.percent).toBe(75);
  });
});

describe("nextNodeId", () => {
  const roadmap = makeRoadmap([topic("a"), topic("b"), topic("c")]);

  it("returns the first node that is neither done nor skipped", () => {
    expect(nextNodeId(roadmap, {})).toBe("a");
    expect(nextNodeId(roadmap, { a: "done" })).toBe("b");
    expect(nextNodeId(roadmap, { a: "skipped", b: "learning" })).toBe("b");
  });

  it("returns undefined when every node is done or skipped", () => {
    expect(nextNodeId(roadmap, { a: "done", b: "done", c: "skipped" })).toBeUndefined();
  });
});

describe("sanitizeStatuses", () => {
  const roadmap = makeRoadmap([topic("a"), topic("b")]);

  it("drops progress for node ids that no longer exist", () => {
    const sanitized = sanitizeStatuses(roadmap, {
      a: "done",
      gone: "done",
      alsoGone: "learning",
    });
    expect(sanitized).toEqual({ a: "done" });
  });

  it("keeps everything when all ids still exist", () => {
    expect(sanitizeStatuses(roadmap, { a: "done", b: "skipped" })).toEqual({
      a: "done",
      b: "skipped",
    });
  });
});

describe("statusesFor", () => {
  it("returns an empty map for an unopened roadmap", () => {
    expect(statusesFor({}, "nope")).toEqual({});
  });
});

describe("selectTrackedRoadmaps", () => {
  const roadmap = makeRoadmap([topic("a"), topic("b")], {
    slug: "alpha",
    title: "Alpha",
  });
  const resolve = (slug: string) => (slug === "alpha" ? roadmap : undefined);

  it("returns tracked roadmaps ordered by most recent update", () => {
    const state: ProgressState = {
      alpha: { updatedAt: "2026-01-02T00:00:00.000Z", statuses: { a: "done" } },
    };
    const result = selectTrackedRoadmaps(state, resolve);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("alpha");
    expect(result[0].summary.percent).toBe(50);
    expect(result[0].nextNodeId).toBe("b");
  });

  it("skips slugs with no roadmap data", () => {
    const state: ProgressState = {
      unknown: { updatedAt: "2026-01-02T00:00:00.000Z", statuses: {} },
    };
    expect(selectTrackedRoadmaps(state, resolve)).toHaveLength(0);
  });
});
