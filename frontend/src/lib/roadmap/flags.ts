/**
 * Feature flags for optional roadmap extras.
 *
 * The AI Tutor is a stub: the tab and floating pill render only when
 * `NEXT_PUBLIC_AI_TUTOR=true` is set at build time. Everything else in the
 * roadmap feature works with the flag off.
 */
export const AI_TUTOR_ENABLED = process.env.NEXT_PUBLIC_AI_TUTOR === "true";
