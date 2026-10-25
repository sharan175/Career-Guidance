"use client";

import { useMemo, useRef } from "react";

import type { NodeStatus, Roadmap, RoadmapNode } from "@/types/roadmap";
import { deriveEdges, groupRows, type Row } from "@/lib/roadmap/layout";
import { useConnectors } from "@/lib/roadmap/useConnectors";
import { InfoCard, RoadmapLinkNode, SectionLabel } from "./NodeChrome";
import { TopicNode } from "./TopicNode";

interface RoadmapCanvasProps {
  roadmap: Roadmap;
  statuses: Record<string, NodeStatus>;
  onOpen: (nodeId: string) => void;
  onSetStatus: (nodeId: string, status: NodeStatus | null) => void;
}

const FLOW_GRID =
  "grid grid-cols-1 items-center justify-items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:justify-items-stretch lg:gap-x-10";

/**
 * The interactive flowchart. Renders rows derived from the roadmap's node list
 * and draws solid (spine→spine) and dotted (spine→side) connectors as SVG,
 * measured from the real DOM so they stay correct across resizes.
 */
export function RoadmapCanvas({ roadmap, statuses, onOpen, onSetStatus }: RoadmapCanvasProps) {
  const rows = useMemo(() => groupRows(roadmap), [roadmap]);
  const edges = useMemo(() => deriveEdges(rows), [rows]);
  const containerRef = useRef<HTMLDivElement>(null);
  const connectors = useConnectors(containerRef, edges);

  const renderNode = (node: RoadmapNode) => {
    if (node.kind === "roadmapLink") return <RoadmapLinkNode node={node} />;
    return (
      <TopicNode
        node={node}
        status={statuses[node.id]}
        onOpen={onOpen}
        onSetStatus={onSetStatus}
      />
    );
  };

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[1000px]">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {connectors.map((connector) => (
          <line
            key={connector.key}
            x1={connector.x1}
            y1={connector.y1}
            x2={connector.x2}
            y2={connector.y2}
            stroke="#2B78E4"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={connector.style === "dotted" ? "0.5 7" : undefined}
          />
        ))}
      </svg>

      <ol className="relative flex flex-col gap-8">
        {rows.map((row, index) => (
          <li key={rowKey(row, index)} className="flex justify-center">
            <CanvasRow row={row} renderNode={renderNode} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function rowKey(row: Row, index: number): string {
  if (row.type === "section" || row.type === "info") return `${row.type}-${row.node.id}`;
  return `flow-${row.spine?.id ?? index}`;
}

function CanvasRow({
  row,
  renderNode,
}: {
  row: Row;
  renderNode: (node: RoadmapNode) => React.ReactNode;
}) {
  if (row.type === "section") return <SectionLabel node={row.node} />;
  if (row.type === "info") {
    return (
      <div className="w-full max-w-md">
        <InfoCard node={row.node} />
      </div>
    );
  }

  return (
    <div className={FLOW_GRID}>
      {/* Spine (DOM-first so it stacks on top on mobile) */}
      <div className="flex justify-center lg:col-start-2 lg:row-start-1">
        {row.spine ? renderNode(row.spine) : null}
      </div>

      {/* Left column */}
      <div className="flex w-full flex-col items-center gap-4 lg:col-start-1 lg:row-start-1 lg:w-auto lg:items-end">
        {row.left.map((node) => (
          <div key={node.id} className="w-full max-w-[16rem] lg:w-auto">
            {renderNode(node)}
          </div>
        ))}
      </div>

      {/* Right column */}
      <div className="flex w-full flex-col items-center gap-4 lg:col-start-3 lg:row-start-1 lg:w-auto lg:items-start">
        {row.right.map((node) => (
          <div key={node.id} className="w-full max-w-[16rem] lg:w-auto">
            {renderNode(node)}
          </div>
        ))}
      </div>
    </div>
  );
}
