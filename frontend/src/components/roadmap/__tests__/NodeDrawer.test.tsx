import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NodeDrawer } from "../NodeDrawer";
import { topic } from "@/lib/roadmap/__tests__/fixtures";

const node = topic("html", {
  label: "Learn HTML",
  description: "Semantic markup is the foundation.",
  resources: [
    { title: "MDN HTML", url: "https://developer.mozilla.org/en-US/docs/Web/HTML", type: "official", free: true },
    { title: "Premium Course", url: "https://www.example.com/course", type: "course", free: false },
  ],
});

function setup(overrides: Partial<Parameters<typeof NodeDrawer>[0]> = {}) {
  const onSetStatus = vi.fn();
  const onClose = vi.fn();
  render(
    <NodeDrawer
      node={node}
      onSetStatus={onSetStatus}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onSetStatus, onClose };
}

describe("NodeDrawer", () => {
  it("renders the title, description and both resource sections", () => {
    setup();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Learn HTML details");
    expect(screen.getByText("Semantic markup is the foundation.")).toBeInTheDocument();
    expect(screen.getByText("Free Resources")).toBeInTheDocument();
    expect(screen.getByText("Premium Resources")).toBeInTheDocument();
  });

  it("shows a colored type badge for each resource", () => {
    setup();
    expect(screen.getByText("Official")).toBeInTheDocument();
    expect(screen.getByText("Course")).toBeInTheDocument();
  });

  it("moves focus into the drawer on mount", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("closes on Escape", () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the overlay is clicked", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Close topic details" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the X button is clicked", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sets a status from the header buttons", () => {
    const { onSetStatus } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onSetStatus).toHaveBeenCalledWith("html", "done");
  });

  it("clears the status when the active status is clicked again", () => {
    const { onSetStatus } = setup({ status: "done" });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onSetStatus).toHaveBeenCalledWith("html", null);
  });
});
