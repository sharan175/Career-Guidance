import type { NodeStatus, RoadmapNode } from "@/types/roadmap";
import { NodeBadge } from "./NodeBadge";
import { StatusToolbar } from "./StatusToolbar";

const STATUS_TEXT: Record<NodeStatus, string> = {
  learning: "status learning",
  done: "status done",
  skipped: "status skipped",
};

interface TopicNodeProps {
  node: RoadmapNode;
  status?: NodeStatus;
  onOpen: (nodeId: string) => void;
  onSetStatus: (nodeId: string, status: NodeStatus | null) => void;
}

/**
 * A progress-bearing node on the roadmap.
 *
 * Spine nodes are bold yellow, side nodes are tan; both carry a 2px black
 * border. The whole thing is a `<button>` so it is keyboard reachable, and its
 * `aria-label` names the topic plus its status (colour is never the only cue).
 */
export function TopicNode({ node, status, onOpen, onSetStatus }: TopicNodeProps) {
  const isSpine = node.lane === "spine";
  const skipped = status === "skipped";

  const fill = isSpine ? "bg-[#FFE800]" : "bg-[#FDE29A]";
  const size = isSpine ? "min-w-[15rem] px-5 py-3 text-base" : "min-w-[10.5rem] px-3 py-2 text-sm";

  return (
    <div
      className="group relative"
      data-node-id={node.id}
      data-node-lane={node.lane}
    >
      {status && status !== "skipped" && <NodeBadge status={status} />}

      <button
        type="button"
        onClick={() => onOpen(node.id)}
        aria-label={`${node.label}${status ? `, ${STATUS_TEXT[status]}` : ""}`}
        className={`w-full rounded-lg border-2 border-black text-center font-bold text-black shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none ${fill} ${size} ${
          skipped ? "opacity-55" : ""
        }`}
      >
        <span className={skipped ? "line-through decoration-2" : ""}>{node.label}</span>
      </button>

      <StatusToolbar
        status={status}
        onSet={(next) => onSetStatus(node.id, next)}
      />
    </div>
  );
}
