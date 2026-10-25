import { describe, expect, it } from "vitest";

import { deriveEdges, groupRows } from "@/lib/roadmap/layout";
import type { RoadmapNode } from "@/types/roadmap";
import { makeRoadmap, topic } from "./fixtures";

const side = (id: string, lane: "left" | "right", parentId: string): RoadmapNode =>
  topic(id, { lane, parentId });

describe("groupRows", () => {
  it("puts section and info nodes on their own rows", () => {
    const roadmap = makeRoadmap([
      { id: "sec", kind: "section", lane: "spine", label: "Basics" },
      topic("a"),
      { id: "info", kind: "info", lane: "spine", label: "Tips" },
    ]);
    const rows = groupRows(roadmap);
    expect(rows.map((r) => r.type)).toEqual(["section", "flow", "info"]);
  });

  it("attaches left/right nodes to the current spine row", () => {
    const roadmap = makeRoadmap([
      topic("spine1"),
      side("l1", "left", "spine1"),
      side("r1", "right", "spine1"),
      topic("spine2"),
    ]);
    const rows = groupRows(roadmap);
    expect(rows).toHaveLength(2);
    const first = rows[0] as Extract<(typeof rows)[0], { type: "flow" }>;
    expect(first.spine?.id).toBe("spine1");
    expect(first.left.map((n) => n.id)).toEqual(["l1"]);
    expect(first.right.map((n) => n.id)).toEqual(["r1"]);
  });

  it("starts a new row for each spine node", () => {
    const roadmap = makeRoadmap([topic("a"), topic("b"), topic("c")]);
    expect(groupRows(roadmap)).toHaveLength(3);
  });
});

describe("deriveEdges", () => {
  it("chains spine nodes with solid edges and side nodes with dotted edges", () => {
    const roadmap = makeRoadmap([
      topic("spine1"),
      side("l1", "left", "spine1"),
      topic("spine2"),
      side("r1", "right", "spine2"),
    ]);
    const edges = deriveEdges(groupRows(roadmap));

    expect(edges).toContainEqual({ from: "spine1", to: "spine2", style: "solid" });
    expect(edges).toContainEqual({ from: "spine1", to: "l1", style: "dotted" });
    expect(edges).toContainEqual({ from: "spine2", to: "r1", style: "dotted" });
    expect(edges.filter((e) => e.style === "solid")).toHaveLength(1);
  });

  it("produces no edges for a single isolated spine node", () => {
    expect(deriveEdges(groupRows(makeRoadmap([topic("a")])))).toHaveLength(0);
  });
});
