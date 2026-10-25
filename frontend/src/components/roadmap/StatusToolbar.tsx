import type { NodeStatus } from "@/types/roadmap";

type Choice = {
  label: string;
  value: NodeStatus;
  activeClass: string;
};

const CHOICES: Choice[] = [
  { label: "Learning", value: "learning", activeClass: "bg-purple-600 text-white" },
  { label: "Done", value: "done", activeClass: "bg-green-600 text-white" },
  { label: "Skip", value: "skipped", activeClass: "bg-slate-600 text-white" },
];

/**
 * Floating toolbar shown above a node on hover / keyboard focus with
 * Learning | Done | Skip. Clicking the already-active choice clears the status,
 * so a status can always be removed from here too.
 */
export function StatusToolbar({
  status,
  onSet,
}: {
  status?: NodeStatus;
  onSet: (status: NodeStatus | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Set topic status"
      className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-black bg-white p-1 opacity-0 shadow-md transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 motion-reduce:transition-none"
    >
      {CHOICES.map((choice) => {
        const active = status === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={active}
            onClick={(event) => {
              event.stopPropagation();
              onSet(active ? null : choice.value);
            }}
            className={`rounded px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
              active ? choice.activeClass : ""
            }`}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
