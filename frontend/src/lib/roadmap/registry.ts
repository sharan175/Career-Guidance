import { roadmapSchema, type Roadmap } from "@/types/roadmap";

import { getGeneratedRoadmap } from "./generated";

import softwareEngineer from "@/data/roadmaps/software-engineer.json";
import fullStackDeveloper from "@/data/roadmaps/full-stack-developer.json";
import dataScientist from "@/data/roadmaps/data-scientist.json";
import machineLearningEngineer from "@/data/roadmaps/machine-learning-engineer.json";
import devopsEngineer from "@/data/roadmaps/devops-engineer.json";
import techProductManager from "@/data/roadmaps/tech-product-manager.json";

/**
 * Roadmap registry — the only place that imports the seed JSON.
 *
 * Every file is validated with zod at load time. Node ids must be stable and
 * unique, and `parentId` / `edges` must reference nodes that exist (enforced
 * by `roadmapSchema`).
 *
 * Failure policy:
 *  - development → throw immediately with the full zod issue list ("fail loudly").
 *  - production  → drop the broken roadmap and record the message so the route
 *                  can render a friendly error instead of crashing the app.
 */

const RAW = [
  softwareEngineer,
  fullStackDeveloper,
  dataScientist,
  machineLearningEngineer,
  devopsEngineer,
  techProductManager,
];

export class RoadmapRegistryError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid roadmap data:\n${issues.join("\n")}`);
    this.name = "RoadmapRegistryError";
  }
}

const registry = new Map<string, Roadmap>();
const failures: string[] = [];

for (const raw of RAW) {
  const result = roadmapSchema.safeParse(raw);
  if (result.success) {
    const roadmap = result.data;
    if (registry.has(roadmap.slug)) {
      failures.push(`duplicate slug "${roadmap.slug}"`);
      continue;
    }
    registry.set(roadmap.slug, roadmap);
  } else {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`
    );
    failures.push(`${(raw as { slug?: string }).slug ?? "unknown"} → ${issues.join("; ")}`);
  }
}

if (failures.length > 0) {
  const error = new RoadmapRegistryError(failures);
  if (process.env.NODE_ENV !== "production") {
    throw error;
  }
  // Never crash a production build over bad seed data — surface it instead.
  // eslint-disable-next-line no-console
  console.error(error.message);
}

/** Non-fatal validation problems (empty when all seed data is valid). */
export function getRegistryErrors(): string[] {
  return [...failures];
}

/**
 * Look up a roadmap by slug, or `undefined` when there is no data for it.
 * Seed data wins; AI-generated roadmaps (see `generated.ts`) are the
 * fallback, so every consumer — canvas, drawer, dashboard — resolves both
 * kinds through this one function.
 */
export function getRoadmap(slug: string): Roadmap | undefined {
  return registry.get(slug) ?? getGeneratedRoadmap(slug);
}

/** All valid roadmaps, ordered by title. */
export function listRoadmaps(): Roadmap[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
}

/** Every slug that has roadmap data (used to validate `linkTo` targets). */
export function roadmapSlugs(): string[] {
  return Array.from(registry.keys());
}
