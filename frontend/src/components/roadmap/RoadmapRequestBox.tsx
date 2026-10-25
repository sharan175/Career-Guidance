"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { endpoints } from "@/lib/api/client";
import { useProgress } from "@/lib/roadmap/ProgressStore";
import { saveGeneratedRoadmap } from "@/lib/roadmap/generated";
import { describeGenerateError } from "@/lib/roadmap/generate";
import type { Roadmap } from "@/types/roadmap";

interface RoadmapRequestBoxProps {
  /** Career name to pre-fill the input with (e.g. from the URL slug). */
  initialCareer?: string;
  autoFocus?: boolean;
  /** Compact variant for the dashboard when cards already exist. */
  compact?: boolean;
}

/**
 * "Request a roadmap" — asks the backend to generate one with Gemini, saves
 * it into the generated-roadmap store (which also mirrors it to the backend
 * store server-side), tracks it on the Dashboard, and navigates to it.
 */
export function RoadmapRequestBox({
  initialCareer = "",
  autoFocus = false,
  compact = false,
}: RoadmapRequestBoxProps) {
  const router = useRouter();
  const { ensure } = useProgress();
  const [career, setCareer] = useState(initialCareer);

  const generate = useMutation({
    mutationFn: (name: string) => endpoints.roadmaps.generate(name),
    onSuccess: (response) => {
      const roadmap = response.data.roadmap as Roadmap;
      // The store validates against the zod schema before accepting it.
      saveGeneratedRoadmap(roadmap);
      ensure(roadmap.slug); // appears under "My Roadmaps" immediately
      router.push(`/roadmap/${roadmap.slug}`);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = career.trim();
    if (!name || generate.isPending) return;
    generate.mutate(name);
  };

  const inputClasses =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-60";

  return (
    <form
      onSubmit={submit}
      className={
        compact
          ? "flex flex-col gap-2 sm:flex-row"
          : "flex flex-col gap-3 sm:flex-row"
      }
    >
      <label className="sr-only" htmlFor="roadmap-request-career">
        Career name
      </label>
      <input
        id="roadmap-request-career"
        type="text"
        value={career}
        onChange={(event) => setCareer(event.target.value)}
        placeholder="e.g. AI Research Scientist"
        autoFocus={autoFocus}
        disabled={generate.isPending}
        maxLength={120}
        className={inputClasses}
      />

      <button
        type="submit"
        disabled={generate.isPending || career.trim().length === 0}
        className="shrink-0 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
      >
        {generate.isPending ? "Generating…" : "Generate with AI"}
      </button>

      {generate.isPending && (
        <p role="status" className="basis-full text-xs text-slate-400 sm:self-center">
          Building the roadmap with Gemini — this can take up to a minute.
        </p>
      )}

      {generate.isError && (
        <p
          role="alert"
          className="basis-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200 sm:self-center"
        >
          {describeGenerateError(generate.error)}
        </p>
      )}
    </form>
  );
}
