import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Domain types (mirrors the JSON roadmap schema from the brief)
 * ------------------------------------------------------------------ */

export type NodeKind = "topic" | "section" | "info" | "roadmapLink";
export type ResourceType =
  | "course"
  | "official"
  | "video"
  | "article"
  | "book"
  | "practice";
export type NodeStatus = "learning" | "done" | "skipped";
export type Lane = "spine" | "left" | "right";
export type NodeVariant = "primary" | "secondary";

export interface Resource {
  title: string;
  url: string;
  type: ResourceType;
  free: boolean;
  badge?: string;
}

export interface RoadmapNode {
  id: string;
  kind: NodeKind;
  label: string;
  description?: string;
  x?: number;
  y?: number;
  lane: Lane;
  parentId?: string;
  resources?: Resource[];
  linkTo?: string;
  variant?: NodeVariant;
}

export interface RoadmapEdge {
  from: string;
  to: string;
  style: "solid" | "dotted";
}

export interface Roadmap {
  slug: string;
  title: string;
  description: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  version: number;
}

/* ------------------------------------------------------------------ *
 * Progress model
 *
 *   { [roadmapSlug]: { updatedAt, statuses: { [nodeId]: status } } }
 * ------------------------------------------------------------------ */

export interface RoadmapProgressEntry {
  updatedAt: string;
  statuses: Record<string, NodeStatus>;
}

export type ProgressState = Record<string, RoadmapProgressEntry>;

/* ------------------------------------------------------------------ *
 * Zod schemas — used to validate roadmap JSON at load time and the
 * persisted progress blob when it comes back out of storage.
 * ------------------------------------------------------------------ */

const httpUrl = z
  .string()
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "must be a valid http(s) URL");

export const nodeKindSchema = z.enum([
  "topic",
  "section",
  "info",
  "roadmapLink",
]);
export const resourceTypeSchema = z.enum([
  "course",
  "official",
  "video",
  "article",
  "book",
  "practice",
]);
export const laneSchema = z.enum(["spine", "left", "right"]);
export const variantSchema = z.enum(["primary", "secondary"]);
export const nodeStatusSchema = z.enum(["learning", "done", "skipped"]);

export const resourceSchema = z.object({
  title: z.string().min(1),
  url: httpUrl,
  type: resourceTypeSchema,
  free: z.boolean(),
  badge: z.string().optional(),
});

export const roadmapNodeSchema = z.object({
  id: z.string().min(1),
  kind: nodeKindSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  lane: laneSchema,
  parentId: z.string().optional(),
  resources: z.array(resourceSchema).optional(),
  linkTo: z.string().optional(),
  variant: variantSchema.optional(),
});

export const roadmapEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  style: z.enum(["solid", "dotted"]),
});

export const roadmapSchema = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    nodes: z.array(roadmapNodeSchema).min(1),
    edges: z.array(roadmapEdgeSchema),
    version: z.number().int().positive(),
  })
  .superRefine((roadmap, ctx) => {
    // Node ids must be stable and unique.
    const seen = new Set<string>();
    roadmap.nodes.forEach((node) => {
      if (seen.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate node id "${node.id}"`,
          path: ["nodes", "id"],
        });
      }
      seen.add(node.id);
    });

    // parentId / edges must reference nodes that exist.
    roadmap.nodes.forEach((node, index) => {
      if (node.parentId && !seen.has(node.parentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `node "${node.id}" references unknown parentId "${node.parentId}"`,
          path: ["nodes", index, "parentId"],
        });
      }
    });
    roadmap.edges.forEach((edge, index) => {
      if (!seen.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `edge.from "${edge.from}" does not exist`,
          path: ["edges", index, "from"],
        });
      }
      if (!seen.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `edge.to "${edge.to}" does not exist`,
          path: ["edges", index, "to"],
        });
      }
    });
  });

/* Persisted progress blob (validated on read so corrupt JSON is dropped). */
export const progressEntrySchema = z.object({
  updatedAt: z.string(),
  statuses: z.record(z.string(), nodeStatusSchema),
});

export const progressStateSchema = z.record(z.string(), progressEntrySchema);
