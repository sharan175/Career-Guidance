import { describe, expect, it } from "vitest";

import { roadmapSchema } from "@/types/roadmap";
import { getRoadmap, listRoadmaps } from "@/lib/roadmap/registry";
import { careerSlug } from "@/lib/roadmap/slug";
import { makeRoadmap, topic } from "./fixtures";

describe("roadmapSchema", () => {
  it("accepts a valid roadmap", () => {
    const result = roadmapSchema.safeParse(makeRoadmap([topic("a")]));
    expect(result.success).toBe(true);
  });

  it("rejects duplicate node ids", () => {
    const result = roadmapSchema.safeParse(makeRoadmap([topic("a"), topic("a")]));
    expect(result.success).toBe(false);
  });

  it("rejects a parentId that references an unknown node", () => {
    const result = roadmapSchema.safeParse(
      makeRoadmap([topic("a", { lane: "left", parentId: "nope" })])
    );
    expect(result.success).toBe(false);
  });

  it("rejects an edge that references an unknown node", () => {
    const roadmap = makeRoadmap([topic("a")]);
    roadmap.edges = [{ from: "a", to: "missing", style: "solid" }];
    expect(roadmapSchema.safeParse(roadmap).success).toBe(false);
  });

  it("rejects a non-http resource URL", () => {
    const node = topic("a", {
      resources: [
        { title: "Bad", url: "javascript:alert(1)", type: "article", free: true },
      ],
    });
    expect(roadmapSchema.safeParse(makeRoadmap([node])).success).toBe(false);
  });
});

describe("roadmap registry (seed data)", () => {
  it("loads every seed roadmap without validation errors", () => {
    const roadmaps = listRoadmaps();
    expect(roadmaps.length).toBeGreaterThanOrEqual(6);
  });

  it("validates a roadmap by slug with 40–80 nodes", () => {
    const roadmap = getRoadmap("software-engineer");
    expect(roadmap).toBeDefined();
    expect(roadmap!.nodes.length).toBeGreaterThanOrEqual(40);
    expect(roadmap!.nodes.length).toBeLessThanOrEqual(80);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getRoadmap("definitely-not-a-career")).toBeUndefined();
  });
});

describe("careerSlug", () => {
  it("slugifies career names from the API", () => {
    expect(careerSlug("Software Engineer")).toBe("software-engineer");
    expect(careerSlug("Data Scientist")).toBe("data-scientist");
    expect(careerSlug("AR/VR Developer")).toBe("ar-vr-developer");
    expect(careerSlug("Tech Product Manager")).toBe("tech-product-manager");
  });
});
