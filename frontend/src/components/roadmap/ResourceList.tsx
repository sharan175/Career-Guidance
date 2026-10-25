import type { Resource, ResourceType } from "@/types/roadmap";

const BADGE: Record<ResourceType, { label: string; classes: string }> = {
  course: { label: "Course", classes: "bg-blue-100 text-blue-800" },
  official: { label: "Official", classes: "bg-emerald-100 text-emerald-800" },
  video: { label: "Video", classes: "bg-rose-100 text-rose-800" },
  article: { label: "Article", classes: "bg-amber-100 text-amber-900" },
  book: { label: "Book", classes: "bg-purple-100 text-purple-800" },
  practice: { label: "Practice", classes: "bg-cyan-100 text-cyan-900" },
};

function ResourceRow({ resource }: { resource: Resource }) {
  const badge = BADGE[resource.type];

  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span className="min-w-0 flex-1">
          <span className="font-medium">{resource.title}</span>
          {resource.badge && (
            <span className="ml-1 text-xs text-slate-500">· {resource.badge}</span>
          )}
        </span>
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${badge.classes}`}
        >
          {badge.label}
        </span>
      </a>
    </li>
  );
}

/**
 * Renders a node's resources split into Free and Premium sections. Empty
 * sections are omitted entirely.
 */
export function ResourceList({ resources }: { resources: Resource[] }) {
  const free = resources.filter((resource) => resource.free);
  const premium = resources.filter((resource) => !resource.free);

  if (resources.length === 0) {
    return (
      <p className="text-sm text-slate-500">No resources listed for this topic yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {free.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Free Resources
          </h3>
          <ul className="flex flex-col gap-2">
            {free.map((resource) => (
              <ResourceRow key={resource.url} resource={resource} />
            ))}
          </ul>
        </section>
      )}

      {premium.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Premium Resources
          </h3>
          <ul className="flex flex-col gap-2">
            {premium.map((resource) => (
              <ResourceRow key={resource.url} resource={resource} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
