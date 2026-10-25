/**
 * End-to-end flow for the Career Roadmap feature.
 *
 * Simulates the real user journey in jsdom:
 *   Recommendations → career link (href) → roadmap renders → mark 3 nodes done
 *   → "reload" (remount) → progress persists from localStorage → Dashboard
 *   "My Roadmaps" card shows the correct %.
 *
 * Next's router/link and the API client are stubbed; the progress store,
 * storage layer and roadmap components are all real.
 */
import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ProgressProvider } from "@/lib/roadmap/ProgressStore";
import { getRoadmap } from "@/lib/roadmap/registry";
import { summarize } from "@/lib/roadmap/progress";
import { STORAGE_KEY } from "@/lib/roadmap/storage";
import { RoadmapView } from "@/components/roadmap/RoadmapView";
import { MyRoadmaps } from "@/components/roadmap/MyRoadmaps";
import RecommendationsPage from "@/app/(main)/recommendations/page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children as React.ReactNode}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/lib/tracking/TrackingProvider", () => ({
  useTracking: () => ({ track: vi.fn() }),
}));

vi.mock("@/lib/api/client", () => ({
  endpoints: {
    recommendations: {
      list: () =>
        Promise.resolve({
          data: {
            count: 1,
            recommendations: [
              {
                recommendation_id: "r1",
                id: "c01",
                name: "Software Engineer",
                category: "software",
                stage1_eligibility: 3,
                stage1_eligible: true,
                prerequisites_met: "dsa, programming_python",
                prerequisites_fraction: 0.6,
                stage2_cf_score: 0.81,
                stage3_fm_score: 0.77,
                contributing_features: {},
                decision: "pending",
              },
            ],
          },
        }),
    },
  },
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), defaults: {} },
  isLoggedIn: () => true,
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  subscribeAuth: () => () => {},
  getAuthVersion: () => 0,
}));

const SLUG = "software-engineer";

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProgressProvider>{ui}</ProgressProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Career Roadmap end-to-end flow", () => {
  it("links a recommended career to its roadmap", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RecommendationsPage />
      </QueryClientProvider>
    );

    const careerLink = await screen.findByRole("link", { name: "Software Engineer" });
    expect(careerLink).toHaveAttribute("href", "/roadmap/software-engineer");

    // The explicit card action links to the same place.
    expect(screen.getByRole("link", { name: /view roadmap/i })).toHaveAttribute(
      "href",
      "/roadmap/software-engineer"
    );
  });

  it("marks nodes, survives a reload, and reports the correct % on the Dashboard", async () => {
    const roadmap = getRoadmap(SLUG)!;
    const topics = roadmap.nodes.filter((node) => node.kind === "topic");
    const [first, second, third] = topics;
    const expected = summarize(roadmap, {
      [first.id]: "done",
      [second.id]: "done",
      [third.id]: "done",
    });

    // --- 1. Open the roadmap and mark three nodes done ---
    const firstRender = renderWithProviders(<RoadmapView slug={SLUG} />);
    for (const node of [first, second, third]) {
      fireEvent.click(screen.getByRole("button", { name: node.label }));
      const dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
      fireEvent.keyDown(document, { key: "Escape" });
    }
    expect(screen.getByText(`${expected.percent}%`)).toBeInTheDocument();
    firstRender.unmount(); // flushes progress to localStorage

    // --- 2. "Reload": a fresh mount must read the persisted progress back ---
    const secondRender = renderWithProviders(<RoadmapView slug={SLUG} />);
    expect(await screen.findByText(`${expected.percent}%`)).toBeInTheDocument();
    secondRender.unmount();

    // --- 3. Dashboard reads the same store and agrees on the % ---
    renderWithProviders(<MyRoadmaps />);
    expect(await screen.findByText("Software Engineer")).toBeInTheDocument();
    expect(screen.getByText(`${expected.percent}%`)).toBeInTheDocument();
    expect(screen.getByText("3 done")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /continue/i })
    ).toHaveAttribute("href", `/roadmap/${SLUG}?node=${encodeURIComponent(topics[3].id)}`);

    // Progress really landed in localStorage under the storage abstraction key.
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain(first.id);
  });
});
