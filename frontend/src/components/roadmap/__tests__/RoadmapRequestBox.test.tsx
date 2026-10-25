import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProgressProvider } from "@/lib/roadmap/ProgressStore";
import { getGeneratedRoadmap } from "@/lib/roadmap/generated";
import type { Roadmap } from "@/types/roadmap";
import { RoadmapRequestBox } from "../RoadmapRequestBox";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

const generate = vi.fn();
vi.mock("@/lib/api/client", () => ({
  endpoints: {
    roadmaps: {
      generate: (...args: unknown[]) => generate(...args),
      mine: () => Promise.resolve({ data: { roadmaps: [] } }),
      detail: () => Promise.reject(new Error("not needed in this test")),
    },
  },
  isLoggedIn: () => true,
}));

const ROADMAP: Roadmap = {
  slug: "robotics-engineer",
  title: "Robotics Engineer",
  description: "AI-generated path.",
  nodes: [{ id: "basics", kind: "section", label: "Basics", lane: "spine" }],
  edges: [],
  version: 1,
};

function renderBox(props: Partial<React.ComponentProps<typeof RoadmapRequestBox>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      {/* no adapter prop: the real localStorage adapter (debounced 250ms) */}
      <ProgressProvider>
        <RoadmapRequestBox {...props} />
      </ProgressProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  push.mockClear();
  generate.mockReset();
  window.localStorage.clear();
});

describe("RoadmapRequestBox", () => {
  it("generates, saves, tracks and navigates on success", async () => {
    generate.mockResolvedValue({ data: { roadmap: ROADMAP } });
    const user = userEvent.setup();
    renderBox();

    const input = screen.getByRole("textbox", { name: /career name/i });
    await user.type(input, "Robotics Engineer");
    await user.click(screen.getByRole("button", { name: /generate with ai/i }));

    await waitFor(() => expect(generate).toHaveBeenCalledWith("Robotics Engineer"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/roadmap/robotics-engineer"));

    // saved into the generated store (validated + mirrored to storage)
    expect(getGeneratedRoadmap("robotics-engineer")?.title).toBe("Robotics Engineer");
    // and tracked so it shows up under My Roadmaps (progress writes are debounced)
    await waitFor(
      () =>
        expect(
          JSON.parse(window.localStorage.getItem("cm_roadmap_progress_v1") ?? "{}")
        ).toHaveProperty("robotics-engineer"),
      { timeout: 2000 }
    );
  });

  it("surfaces a friendly message when generation fails with 503", async () => {
    generate.mockRejectedValue({ response: { status: 503, data: {} } });
    const user = userEvent.setup();
    renderBox();

    await user.type(screen.getByRole("textbox", { name: /career name/i }), "Anyone");
    await user.click(screen.getByRole("button", { name: /generate with ai/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/LLM_API_KEY/);
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps submit disabled while the field is empty", () => {
    renderBox();
    expect(screen.getByRole("button", { name: /generate with ai/i })).toBeDisabled();
  });
});
