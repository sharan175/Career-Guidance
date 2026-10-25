import type { Roadmap, RoadmapNode } from "@/types/roadmap";

/** Tiny builders shared by the roadmap unit/component tests. */

export function topic(id: string, opts: Partial<RoadmapNode> = {}): RoadmapNode {
  return { id, kind: "topic", lane: "spine", label: id, ...opts };
}

export function makeRoadmap(
  nodes: RoadmapNode[],
  overrides: Partial<Roadmap> = {}
): Roadmap {
  return {
    slug: "test-roadmap",
    title: "Test Roadmap",
    description: "fixture roadmap",
    version: 1,
    nodes,
    edges: [],
    ...overrides,
  };
}
