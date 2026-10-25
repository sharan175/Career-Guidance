import type {
  NodeStatus,
  ProgressState,
  Roadmap,
  RoadmapNode,
} from "@/types/roadmap";

/**
 * Pure progress logic — no React, no storage. Everything here is trivially
 * unit-testable and shared by the roadmap page and the dashboard so the two
 * can never disagree (single source of truth).
 *
 * Only `topic` nodes are progress-bearing; `section`, `info` and `roadmapLink`
 * nodes never count toward the numbers.
 */

export function topicNodes(roadmap: Roadmap): RoadmapNode[] {
  return roadmap.nodes.filter((node) => node.kind === "topic");
}

export interface ProgressSummary {
  /** Total topic nodes (progress denominator basis). */
  total: number;
  done: number;
  learning: number;
  skipped: number;
  /** number of nodes that are neither done nor skipped (the denominator). */
  denominator: number;
  /** 0–100, whole number. done / (total - skipped), 0 when denominator is 0. */
  percent: number;
}

/** The statuses map for a roadmap, or an empty map if it has never been opened. */
export function statusesFor(
  state: ProgressState,
  slug: string
): Record<string, NodeStatus> {
  return state[slug]?.statuses ?? {};
}

export function summarize(
  roadmap: Roadmap,
  statuses: Record<string, NodeStatus>
): ProgressSummary {
  const topics = topicNodes(roadmap);
  const total = topics.length;

  let done = 0;
  let learning = 0;
  let skipped = 0;

  for (const topic of topics) {
    const status = statuses[topic.id];
    if (status === "done") done += 1;
    else if (status === "learning") learning += 1;
    else if (status === "skipped") skipped += 1;
  }

  const denominator = Math.max(0, total - skipped);
  // Divide-by-zero guard: if every topic is skipped the ratio is 0/0 → 0.
  const percent = denominator === 0 ? 0 : Math.round((done / denominator) * 100);

  return { total, done, learning, skipped, denominator, percent };
}

/**
 * The "Continue" target: the first topic that is neither done nor skipped,
 * in document order (so an in-progress node is picked up where you left it).
 * Returns undefined when every topic is done or skipped.
 */
export function nextNodeId(
  roadmap: Roadmap,
  statuses: Record<string, NodeStatus>
): string | undefined {
  for (const topic of topicNodes(roadmap)) {
    const status = statuses[topic.id];
    if (status !== "done" && status !== "skipped") return topic.id;
  }
  return undefined;
}

/**
 * Drop progress entries for node ids that no longer exist on the roadmap, so a
 * roadmap `version` bump (renamed/removed nodes) never breaks saved progress.
 * Entries for ids that still exist but are no longer topics are kept (harmless
 * — the selectors only ever read topic nodes).
 */
export function sanitizeStatuses(
  roadmap: Roadmap,
  statuses: Record<string, NodeStatus>
): Record<string, NodeStatus> {
  const ids = new Set(roadmap.nodes.map((node) => node.id));
  const result: Record<string, NodeStatus> = {};
  for (const [nodeId, status] of Object.entries(statuses)) {
    if (ids.has(nodeId)) result[nodeId] = status;
  }
  return result;
}

export interface RoadmapSummary {
  slug: string;
  title: string;
  description: string;
  summary: ProgressSummary;
  nextNodeId: string | undefined;
}

/**
 * Dashboard selector: turn the tracked slugs in the progress state into card
 * data, ordered most-recently-updated first.
 */
export function selectTrackedRoadmaps(
  state: ProgressState,
  resolve: (slug: string) => Roadmap | undefined
): RoadmapSummary[] {
  return Object.keys(state)
    .map((slug) => {
      const roadmap = resolve(slug);
      if (!roadmap) return null;
      const statuses = statusesFor(state, slug);
      return {
        slug,
        title: roadmap.title,
        description: roadmap.description,
        summary: summarize(roadmap, statuses),
        nextNodeId: nextNodeId(roadmap, statuses),
      };
    })
    .filter((entry): entry is RoadmapSummary => entry !== null)
    .sort((a, b) => {
      const aTime = state[a.slug]?.updatedAt ?? "";
      const bTime = state[b.slug]?.updatedAt ?? "";
      return bTime.localeCompare(aTime);
    });
}
