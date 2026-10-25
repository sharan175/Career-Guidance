import Link from "next/link";

import type { RoadmapSummary } from "@/lib/roadmap/progress";
import { ProgressBar } from "./ProgressBar";

interface RoadmapCardProps {
  entry: RoadmapSummary;
  onRemove: (slug: string) => void;
}

/**
 * Presentational "My Roadmaps" card for the Dashboard: career name, % complete,
 * done/learning/skipped counts, a progress bar, a Continue link and a remove
 * option.
 */
export function RoadmapCard({ entry, onRemove }: RoadmapCardProps) {
  const { slug, title, description, summary, nextNodeId } = entry;

  const continueHref = nextNodeId
    ? `/roadmap/${slug}?node=${encodeURIComponent(nextNodeId)}`
    : `/roadmap/${slug}`;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{description}</p>
        </div>

        <button
          type="button"
          onClick={() => onRemove(slug)}
          aria-label={`Remove ${title} from My Roadmaps`}
          className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <ProgressBar percent={summary.percent} label={`${title} progress`} />
        <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-800">
          {summary.percent}%
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>{summary.done} done</span>
        <span>{summary.learning} learning</span>
        <span>{summary.skipped} skipped</span>
      </div>

      <Link
        href={continueHref}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#2B78E4] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Continue <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
