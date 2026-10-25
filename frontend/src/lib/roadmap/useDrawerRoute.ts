"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Keeps the open-node drawer in sync with the `?node=<id>` query parameter
 * using the History API directly (avoids Next router re-render churn).
 *
 * - Opening pushes a history entry, so the browser Back button closes the drawer.
 * - Switching nodes while open replaces (no history spam on rapid clicks).
 * - A deep link (`/roadmap/x?node=y`) opens the drawer on mount.
 * - Unknown node ids in the URL are ignored.
 */
export function useDrawerRoute(validIds: Set<string>) {
  const [nodeId, setNodeId] = useState<string | null>(null);

  useEffect(() => {
    const readFromUrl = () => {
      const param = new URLSearchParams(window.location.search).get("node");
      return param && validIds.has(param) ? param : null;
    };

    setNodeId(readFromUrl());

    const onPopState = () => setNodeId(readFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [validIds]);

  const open = useCallback(
    (id: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set("node", id);
      if (nodeId) {
        window.history.replaceState(null, "", url.toString());
      } else {
        window.history.pushState(null, "", url.toString());
      }
      setNodeId(id);
    },
    [nodeId]
  );

  const close = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("node");
    window.history.replaceState(null, "", url.toString());
    setNodeId(null);
  }, []);

  return { nodeId, open, close };
}
