import type { Roadmap, RoadmapNode } from "@/types/roadmap";

/**
 * Pure layout maths: turn the flat node list into visual rows.
 *
 * The canvas is a centred vertical "spine" with side columns. A `section` or
 * `info` node takes a full-width row of its own; a spine `topic` starts a new
 * flow row; left/right nodes attach to the current flow row. No React, no DOM —
 * unit-testable in isolation.
 */

export type Row =
  | { type: "section"; node: RoadmapNode }
  | { type: "info"; node: RoadmapNode }
  | {
      type: "flow";
      spine: RoadmapNode | null;
      left: RoadmapNode[];
      right: RoadmapNode[];
    };

export function groupRows(roadmap: Roadmap): Row[] {
  const rows: Row[] = [];
  let current: Extract<Row, { type: "flow" }> | null = null;

  for (const node of roadmap.nodes) {
    if (node.kind === "section") {
      rows.push({ type: "section", node });
      current = null;
      continue;
    }
    if (node.kind === "info") {
      rows.push({ type: "info", node });
      current = null;
      continue;
    }

    if (node.lane === "spine") {
      current = { type: "flow", spine: node, left: [], right: [] };
      rows.push(current);
      continue;
    }

    // Side node (sub-topic or roadmap link).
    if (!current) {
      current = { type: "flow", spine: null, left: [], right: [] };
      rows.push(current);
    }
    if (node.lane === "left") current.left.push(node);
    else current.right.push(node);
  }

  return rows;
}

/**
 * Derive connector edges from the row layout: a solid vertical link between
 * consecutive spine nodes, and dotted links from a spine node out to each of
 * its side nodes. Keeps the JSON free of hand-written edge bookkeeping.
 */
export function deriveEdges(rows: Row[]): { from: string; to: string; style: "solid" | "dotted" }[] {
  const edges: { from: string; to: string; style: "solid" | "dotted" }[] = [];
  let previousSpineId: string | undefined;

  for (const row of rows) {
    if (row.type !== "flow") continue;

    if (row.spine) {
      if (previousSpineId) {
        edges.push({ from: previousSpineId, to: row.spine.id, style: "solid" });
      }
      previousSpineId = row.spine.id;
      for (const node of row.left) {
        edges.push({ from: row.spine.id, to: node.id, style: "dotted" });
      }
      for (const node of row.right) {
        edges.push({ from: row.spine.id, to: node.id, style: "dotted" });
      }
      continue;
    }

    // Column-only row: tether the side nodes to the nearest spine above.
    const anchor = previousSpineId;
    if (!anchor) continue;
    for (const node of [...row.left, ...row.right]) {
      edges.push({ from: anchor, to: node.id, style: "dotted" });
    }
  }

  return edges;
}

/** Every node id on the roadmap, in document order. */
export function allNodeIds(roadmap: Roadmap): string[] {
  return roadmap.nodes.map((node) => node.id);
}
