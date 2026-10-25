import type { NodeStatus } from "@/types/roadmap";

const LABEL: Record<NodeStatus, string> = {
  learning: "Learning",
  done: "Done",
  skipped: "Skipped",
};

/**
 * Small status circle that overlaps the node's top-left corner.
 *
 * Colour is never the only cue: each badge carries a distinct icon, and the
 * node's `aria-label` spells the status out in words. A node with no status
 * renders nothing; a skipped node has no badge (it is dimmed + struck through
 * instead).
 */
export function NodeBadge({ status }: { status: NodeStatus }) {
  if (status === "skipped") return null;

  const color = status === "learning" ? "bg-purple-600" : "bg-green-600";

  return (
    <span
      aria-hidden="true"
      title={LABEL[status]}
      className={`pointer-events-none absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-black text-white shadow-sm ${color}`}
    >
      {status === "done" ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="M3 8.5l3.2 3.2L13 5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        /* learning: a filled dot glyph */
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="8" r="4" />
        </svg>
      )}
    </span>
  );
}
