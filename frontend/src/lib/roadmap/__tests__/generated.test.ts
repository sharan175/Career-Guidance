import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGeneratedRoadmap,
  mergeGeneratedRoadmaps,
  resetGeneratedStore,
  saveGeneratedRoadmap,
} from "@/lib/roadmap/generated";
import { careerFromSlug, describeGenerateError, slugRoundTrips } from "@/lib/roadmap/generate";
import { getRoadmap } from "@/lib/roadmap/registry";
import type { Roadmap } from "@/types/roadmap";
import { makeRoadmap, topic } from "./fixtures";

const STORAGE_KEY = "cm_generated_roadmaps_v1";

function generated(): Roadmap {
  return makeRoadmap([topic("t1", { label: "Learn Rust" })], {
    slug: "rust-developer",
    title: "Rust Developer",
  });
}

describe("generated roadmap store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetGeneratedStore();
  });

  it("saves and resolves a roadmap, and registry falls back to it", () => {
    saveGeneratedRoadmap(generated());

    expect(getGeneratedRoadmap("rust-developer")?.title).toBe("Rust Developer");
    // Seed data still wins for seed slugs; generated fills the gaps.
    expect(getRoadmap("rust-developer")?.title).toBe("Rust Developer");
    expect(getRoadmap("software-engineer")?.slug).toBe("software-engineer");
    expect(getRoadmap("never-existed")).toBeUndefined();
  });

  it("persists to localStorage so a reload keeps the roadmap", () => {
    saveGeneratedRoadmap(generated());

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(Object.keys(JSON.parse(raw!))).toEqual(["rust-developer"]);

    // Simulate a reload: dropping the cache forces a re-read from storage.
    resetGeneratedStore();
    expect(getGeneratedRoadmap("rust-developer")?.title).toBe("Rust Developer");
  });

  it("refuses roadmaps that fail the schema", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const broken = { ...generated(), nodes: [{ id: "x", kind: "nope" }] };
      saveGeneratedRoadmap(broken as unknown as Roadmap);

      expect(getGeneratedRoadmap("rust-developer")).toBeUndefined();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("drops corrupt storage instead of crashing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    resetGeneratedStore();
    expect(getGeneratedRoadmap("rust-developer")).toBeUndefined();

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ bad: { nope: true } }));
    resetGeneratedStore();
    expect(getGeneratedRoadmap("bad")).toBeUndefined();
  });

  it("merges backend roadmaps without overwriting existing local ones", () => {
    saveGeneratedRoadmap(generated());

    const incoming = makeRoadmap([topic("c1")], {
      slug: "cloud-engineer",
      title: "Cloud Engineer",
    });
    const sameSlug = makeRoadmap([topic("r1")], {
      slug: "rust-developer",
      title: "Rust Developer REMOTE",
    });
    mergeGeneratedRoadmaps([incoming, sameSlug]);

    expect(getGeneratedRoadmap("cloud-engineer")?.title).toBe("Cloud Engineer");
    expect(getGeneratedRoadmap("rust-developer")?.title).toBe("Rust Developer");
  });

  it("returns undefined when there is no window (SSR)", () => {
    saveGeneratedRoadmap(generated());
    vi.stubGlobal("window", undefined);
    try {
      expect(getGeneratedRoadmap("rust-developer")).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
    // still intact after the stub is lifted
    expect(getGeneratedRoadmap("rust-developer")?.title).toBe("Rust Developer");
  });
});

describe("generate helpers", () => {
  it("careerFromSlug round-trips through careerSlug", () => {
    expect(careerFromSlug("ar-vr-developer")).toBe("Ar Vr Developer");
    expect(slugRoundTrips("AR/VR Developer")).toBe(true);
    expect(slugRoundTrips("Data Scientist")).toBe(true);
  });

  it("maps error statuses to friendly messages", () => {
    const withStatus = (status?: number, detail?: string) => ({
      response: { status, data: detail ? { detail } : {} },
    });
    expect(describeGenerateError(withStatus(503))).toMatch(/LLM_API_KEY/);
    expect(describeGenerateError(withStatus(401))).toMatch(/login/i);
    expect(describeGenerateError(withStatus(429))).toMatch(/wait/i);
    expect(describeGenerateError(withStatus(502, "unusable"))).toBe("unusable");
    expect(describeGenerateError(new Error("network"))).toMatch(/reach the server/i);
  });
});
