import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopicNode } from "../TopicNode";
import { topic } from "@/lib/roadmap/__tests__/fixtures";

describe("TopicNode", () => {
  it("renders its label", () => {
    render(<TopicNode node={topic("a", { label: "Learn HTML" })} onOpen={() => {}} onSetStatus={() => {}} />);
    expect(screen.getByRole("button", { name: "Learn HTML" })).toBeInTheDocument();
  });

  it("includes the status in the aria-label (colour is never the only cue)", () => {
    render(
      <TopicNode node={topic("a", { label: "CSS" })} status="done" onOpen={() => {}} onSetStatus={() => {}} />
    );
    expect(screen.getByRole("button", { name: "CSS, status done" })).toBeInTheDocument();
  });

  it("shows a green check badge when done", () => {
    render(
      <TopicNode node={topic("a", { label: "CSS" })} status="done" onOpen={() => {}} onSetStatus={() => {}} />
    );
    const badge = document.querySelector(".bg-green-600");
    expect(badge).not.toBeNull();
  });

  it("shows a purple badge when learning", () => {
    render(
      <TopicNode node={topic("a", { label: "CSS" })} status="learning" onOpen={() => {}} onSetStatus={() => {}} />
    );
    expect(document.querySelector(".bg-purple-600")).not.toBeNull();
  });

  it("renders no badge when skipped, and strikes the label through", () => {
    const { container } = render(
      <TopicNode node={topic("a", { label: "CSS" })} status="skipped" onOpen={() => {}} onSetStatus={() => {}} />
    );
    expect(container.querySelector(".bg-green-600")).toBeNull();
    expect(container.querySelector(".bg-purple-600")).toBeNull();
    expect(screen.getByText("CSS").className).toContain("line-through");
  });

  it("renders no badge when there is no status", () => {
    const { container } = render(
      <TopicNode node={topic("a", { label: "CSS" })} onOpen={() => {}} onSetStatus={() => {}} />
    );
    expect(container.querySelector(".bg-green-600")).toBeNull();
    expect(container.querySelector(".bg-purple-600")).toBeNull();
  });

  it("opens the drawer when the node is clicked", () => {
    const onOpen = vi.fn();
    render(<TopicNode node={topic("a", { label: "CSS" })} onOpen={onOpen} onSetStatus={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "CSS" }));
    expect(onOpen).toHaveBeenCalledWith("a");
  });

  it("sets a status from the hover toolbar", () => {
    const onSetStatus = vi.fn();
    render(
      <TopicNode node={topic("a", { label: "CSS" })} onOpen={() => {}} onSetStatus={onSetStatus} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onSetStatus).toHaveBeenCalledWith("a", "done");
  });

  it("clears the status when the active toolbar choice is clicked again", () => {
    const onSetStatus = vi.fn();
    render(
      <TopicNode node={topic("a", { label: "CSS" })} status="done" onOpen={() => {}} onSetStatus={onSetStatus} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onSetStatus).toHaveBeenCalledWith("a", null);
  });
});
