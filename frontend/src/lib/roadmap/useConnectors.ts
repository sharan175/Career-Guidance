"use client";

import { useEffect, useState } from "react";

import type { RoadmapEdge } from "@/types/roadmap";

export interface Connector {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: "solid" | "dotted";
}

const WIDE_QUERY = "(min-width: 1024px)";

/**
 * Measures the rendered position of every node and turns the roadmap's edges
 * into SVG connector coordinates (relative to the container).
 *
 * A `ResizeObserver` on the container and on each node keeps the lines correct
 * on resize; connectors are disabled below `lg` where the side columns stack
 * under the spine and straight lines would no longer make sense.
 */
export function useConnectors(
  containerRef: React.RefObject<HTMLElement | null>,
  edges: RoadmapEdge[]
): Connector[] {
  const [connectors, setConnectors] = useState<Connector[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wideMql = window.matchMedia(WIDE_QUERY);

    const compute = () => {
      if (!container) return;

      if (!wideMql.matches) {
        setConnectors([]);
        return;
      }

      const base = container.getBoundingClientRect();
      const next: Connector[] = [];

      for (const edge of edges) {
        const fromEl = container.querySelector<HTMLElement>(
          `[data-node-id="${edge.from}"]`
        );
        const toEl = container.querySelector<HTMLElement>(
          `[data-node-id="${edge.to}"]`
        );
        if (!fromEl || !toEl) continue;

        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();

        if (edge.style === "solid") {
          next.push({
            key: `${edge.from}->${edge.to}`,
            x1: a.left + a.width / 2 - base.left,
            y1: a.bottom - base.top,
            x2: b.left + b.width / 2 - base.left,
            y2: b.top - base.top,
            style: "solid",
          });
        } else {
          const childIsLeft = b.left + b.width / 2 < a.left + a.width / 2;
          next.push({
            key: `${edge.from}->${edge.to}`,
            x1: (childIsLeft ? a.left : a.right) - base.left,
            y1: a.top + a.height / 2 - base.top,
            x2: (childIsLeft ? b.right : b.left) - base.left,
            y2: b.top + b.height / 2 - base.top,
            style: "dotted",
          });
        }
      }

      setConnectors(next);
    };

    compute();

    const observer = new ResizeObserver(compute);
    observer.observe(container);
    container
      .querySelectorAll<HTMLElement>("[data-node-id]")
      .forEach((element) => observer.observe(element));

    wideMql.addEventListener("change", compute);

    return () => {
      observer.disconnect();
      wideMql.removeEventListener("change", compute);
    };
  }, [containerRef, edges]);

  return connectors;
}
