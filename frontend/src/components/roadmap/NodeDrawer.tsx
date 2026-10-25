"use client";

import { useEffect, useRef, useState } from "react";

import type { NodeStatus, RoadmapNode } from "@/types/roadmap";
import { AI_TUTOR_ENABLED } from "@/lib/roadmap/flags";
import { ResourceList } from "./ResourceList";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type Tab = "resources" | "tutor";

interface NodeDrawerProps {
  node: RoadmapNode;
  status?: NodeStatus;
  onSetStatus: (nodeId: string, status: NodeStatus | null) => void;
  onClose: () => void;
}

const STATUS_BUTTONS: { label: string; value: NodeStatus }[] = [
  { label: "Learning", value: "learning" },
  { label: "Done", value: "done" },
  { label: "Skip", value: "skipped" },
];

const STATUS_ACTIVE: Record<NodeStatus, string> = {
  learning: "border-purple-600 bg-purple-600 text-white",
  done: "border-green-600 bg-green-600 text-white",
  skipped: "border-slate-600 bg-slate-600 text-white",
};

/**
 * Right-hand detail drawer for a single node.
 *
 * - Dims the page behind a semi-transparent overlay (click to close).
 * - Esc, overlay click and the X button all close it.
 * - Traps focus while open and restores it on close.
 * - Locks body scroll (with scrollbar-width compensation) to avoid layout shift.
 * - Mounts/unmounts per open, so its state never leaks between nodes.
 */
export function NodeDrawer({ node, status, onSetStatus, onClose }: NodeDrawerProps) {
  const [tab, setTab] = useState<Tab>("resources");
  const [visible, setVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Slide-in transition (skipped entirely under prefers-reduced-motion via CSS).
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Remember what had focus, move focus into the drawer, restore on unmount.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    return () => previouslyFocused.current?.focus?.();
  }, []);

  // Lock body scroll without shifting layout.
  useEffect(() => {
    const body = document.body;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, []);

  // Esc to close + focus trap.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusables = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !drawer.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !drawer.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const toggleStatus = (value: NodeStatus) => {
    onSetStatus(node.id, status === value ? null : value);
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close topic details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-900/50"
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${node.label} details`}
        tabIndex={-1}
        className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none sm:w-[min(550px,100%)] ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header: status controls, tabs, close */}
        <div className="border-b border-slate-200 px-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_BUTTONS.map((button) => {
                const active = status === button.value;
                return (
                  <button
                    key={button.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleStatus(button.value)}
                    className={`rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      active
                        ? STATUS_ACTIVE[button.value]
                        : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {button.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {AI_TUTOR_ENABLED && (
            <div role="tablist" aria-label="Topic detail sections" className="mt-3 flex gap-4">
              {(
                [
                  { id: "resources", label: "Resources" },
                  { id: "tutor", label: "AI Tutor" },
                ] as { id: Tab; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={`border-b-2 pb-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    tab === item.id
                      ? "border-[#2B78E4] text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <h2 className="text-2xl font-bold leading-tight text-slate-900">{node.label}</h2>

          {node.description && (
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{node.description}</p>
          )}

          <div className="mt-6">
            {tab === "tutor" ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">AI Tutor (coming soon)</p>
                <p className="mt-1">
                  Ask questions about this topic and get guided answers. This feature is behind a
                  flag and not wired up yet.
                </p>
              </div>
            ) : (
              <ResourceList resources={node.resources ?? []} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
