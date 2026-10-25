import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// RoadmapRequestBox (rendered by MyRoadmaps) uses the app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

import { MyRoadmaps } from "../MyRoadmaps";
import { ProgressProvider, useProgress, type ProgressContextValue } from "@/lib/roadmap/ProgressStore";
import { getRoadmap } from "@/lib/roadmap/registry";
import { summarize } from "@/lib/roadmap/progress";
import type { ProgressAdapter } from "@/lib/roadmap/storage";
import type { ProgressState } from "@/types/roadmap";

function memoryAdapter(initial: ProgressState = {}): ProgressAdapter {
  let state = initial;
  return {
    read: () => state,
    write: (next: ProgressState) => {
      state = next;
    },
  };
}

/** Exposes the store API so a test can drive it like the roadmap page would. */
function Harness({ onReady }: { onReady: (api: ProgressContextValue) => void }) {
  onReady(useProgress());
  return <MyRoadmaps />;
}

/** MyRoadmaps issues a react-query list fetch when logged in. */
function withProviders(ui: React.ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <ProgressProvider adapter={memoryAdapter()}>{ui}</ProgressProvider>
    </QueryClientProvider>
  );
}

const SLUG = "software-engineer";

describe("MyRoadmaps", () => {
  it("shows an empty state when nothing has been opened", () => {
    render(withProviders(<MyRoadmaps />));
    expect(screen.getByText(/no roadmaps yet/i)).toBeInTheDocument();
    // the request box is offered alongside the empty state
    expect(screen.getByRole("button", { name: /generate with ai/i })).toBeInTheDocument();
  });

  it("adds a card when a roadmap is opened, and updates its percent as statuses change", () => {
    let api!: ProgressContextValue;
    render(withProviders(<Harness onReady={(value) => (api = value)} />));

    act(() => api.ensure(SLUG));
    const card = screen.getByText("Software Engineer");
    expect(card).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();

    const roadmap = getRoadmap(SLUG)!;
    const topics = roadmap.nodes.filter((node) => node.kind === "topic");

    act(() => api.setStatus(SLUG, topics[0].id, "done"));
    act(() => api.setStatus(SLUG, topics[1].id, "done"));
    act(() => api.setStatus(SLUG, topics[2].id, "learning"));

    const expected = summarize(roadmap, {
      [topics[0].id]: "done",
      [topics[1].id]: "done",
      [topics[2].id]: "learning",
    });
    expect(screen.getByText(`${expected.percent}%`)).toBeInTheDocument();
    expect(screen.getByText("2 done")).toBeInTheDocument();
    expect(screen.getByText("1 learning")).toBeInTheDocument();
  });

  it("removes a card when the roadmap is removed", () => {
    let api!: ProgressContextValue;
    render(withProviders(<Harness onReady={(value) => (api = value)} />));

    act(() => api.ensure(SLUG));
    expect(screen.getByText("Software Engineer")).toBeInTheDocument();

    act(() => api.remove(SLUG));
    expect(screen.queryByText("Software Engineer")).not.toBeInTheDocument();
  });
});
