import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoadmapCard } from "../RoadmapCard";
import type { RoadmapSummary } from "@/lib/roadmap/progress";

const entry: RoadmapSummary = {
  slug: "software-engineer",
  title: "Software Engineer",
  description: "A beginner-to-advanced path.",
  nextNodeId: "pick-language",
  summary: { total: 40, done: 10, learning: 4, skipped: 2, denominator: 38, percent: 26 },
};

describe("RoadmapCard", () => {
  it("renders the career name and percent complete", () => {
    render(<RoadmapCard entry={entry} onRemove={() => {}} />);
    expect(screen.getByText("Software Engineer")).toBeInTheDocument();
    expect(screen.getByText("26%")).toBeInTheDocument();
  });

  it("renders done/learning/skipped counts", () => {
    render(<RoadmapCard entry={entry} onRemove={() => {}} />);
    expect(screen.getByText("10 done")).toBeInTheDocument();
    expect(screen.getByText("4 learning")).toBeInTheDocument();
    expect(screen.getByText("2 skipped")).toBeInTheDocument();
  });

  it("links Continue to the first non-done node via ?node=", () => {
    render(<RoadmapCard entry={entry} onRemove={() => {}} />);
    const link = screen.getByRole("link", { name: /continue/i });
    expect(link).toHaveAttribute("href", "/roadmap/software-engineer?node=pick-language");
  });

  it("links Continue to the roadmap root when nothing is left to do", () => {
    const complete = { ...entry, nextNodeId: undefined };
    render(<RoadmapCard entry={complete} onRemove={() => {}} />);
    expect(screen.getByRole("link", { name: /continue/i })).toHaveAttribute(
      "href",
      "/roadmap/software-engineer"
    );
  });

  it("calls onRemove with the slug", () => {
    const onRemove = vi.fn();
    render(<RoadmapCard entry={entry} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: /remove software engineer/i }));
    expect(onRemove).toHaveBeenCalledWith("software-engineer");
  });
});
