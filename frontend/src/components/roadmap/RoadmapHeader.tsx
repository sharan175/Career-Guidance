import type { ProgressSummary } from "@/lib/roadmap/progress";
import { ProgressBar } from "./ProgressBar";

interface RoadmapHeaderProps {
  title: string;
  description: string;
  summary: ProgressSummary;
  onBack: () => void;
  onShare: () => void;
  onReset: () => void;
}

/** Career title, overall progress, and the Back / Share / Reset controls. */
export function RoadmapHeader({
  title,
  description,
  summary,
  onBack,
  onShare,
  onReset,
}: RoadmapHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span aria-hidden="true">←</span> Back
        </button>

        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Share
        </button>
      </div>

      <h1 className="mt-4 text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>

      <div className="mt-5 flex items-center gap-3">
        <ProgressBar percent={summary.percent} label={`${title} progress`} />
        <span className="w-12 shrink-0 text-right text-sm font-bold text-slate-800">
          {summary.percent}%
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-green-600" />
          {summary.done} done
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-purple-600" />
          {summary.learning} learning
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-slate-400" />
          {summary.skipped} skipped
        </span>

        <button
          type="button"
          onClick={onReset}
          className="ml-auto font-semibold text-rose-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          Reset progress
        </button>
      </div>
    </header>
  );
}
