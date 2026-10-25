/**
 * Maps a career name (as returned by the Recommendations / Pathways API) to its
 * roadmap slug. The rule is a plain `slugify` of the career name, e.g.
 * "Data Scientist" → "data-scientist", "AR/VR Developer" → "ar-vr-developer".
 *
 * The file name in `src/data/roadmaps/` must equal the resulting slug.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Roadmap slug for a career name, e.g. "Data Scientist" → "data-scientist". */
export function careerSlug(careerName: string): string {
  return slugify(careerName.trim());
}
