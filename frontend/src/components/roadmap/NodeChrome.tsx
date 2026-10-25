import Link from "next/link";

import type { RoadmapNode } from "@/types/roadmap";

/** Plain-text section label with a short connector stub underneath. */
export function SectionLabel({ node }: { node: RoadmapNode }) {
  return (
    <div
      className="flex flex-col items-center"
      data-node-id={node.id}
      data-node-lane={node.lane}
    >
      <span className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">
        {node.label}
      </span>
      <span aria-hidden="true" className="mt-3 h-6 w-0.5 rounded bg-[#2B78E4]" />
    </div>
  );
}

/**
 * Reusable `InfoCard` node: a light rounded box with short guidance text and a
 * grey button. The button target comes from the node's first resource.
 */
export function InfoCard({ node }: { node: RoadmapNode }) {
  const action = node.resources?.[0];

  return (
    <div
      className="rounded-xl border-2 border-black bg-slate-50 p-4 text-left shadow-sm sm:p-5"
      data-node-id={node.id}
      data-node-lane={node.lane}
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{node.label}</h3>
      {node.description && (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{node.description}</p>
      )}
      {action && (
        <a
          href={action.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center rounded-md border border-slate-400 bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {action.title}
        </a>
      )}
    </div>
  );
}

/** Solid blue link node that points at another career roadmap. */
export function RoadmapLinkNode({ node }: { node: RoadmapNode }) {
  const target = node.linkTo ? `/roadmap/${node.linkTo}` : undefined;

  const classes =
    "block w-full rounded-lg border-2 border-black bg-[#2B78E4] px-3 py-2 text-center text-sm font-bold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 motion-reduce:transition-none";

  return (
    <div data-node-id={node.id} data-node-lane={node.lane}>
      {target ? (
        <Link href={target} className={classes} aria-label={`${node.label} roadmap`}>
          {node.label} →
        </Link>
      ) : (
        <span className={`${classes} cursor-default opacity-70`}>{node.label}</span>
      )}
    </div>
  );
}
