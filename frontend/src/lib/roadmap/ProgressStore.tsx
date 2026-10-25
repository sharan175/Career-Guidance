"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

import type { NodeStatus, ProgressState } from "@/types/roadmap";
import type { ProgressAdapter } from "./storage";
import { debounceAdapter, localStorageAdapter, subscribeExternal } from "./storage";

/**
 * The single source of truth for roadmap progress. Both the roadmap page and
 * the dashboard read from this store, so they can never disagree.
 *
 * - Reducer is pure (timestamps are supplied by the action creators).
 * - Hydration happens after mount to avoid an SSR/client hydration mismatch.
 * - Writes are delegated to a `ProgressAdapter` (localStorage by default,
 *   debounced), and are flushed on unmount / tab close.
 * - A `storage`-event subscription keeps multiple tabs in sync.
 */

type Action =
  | { type: "hydrate"; state: ProgressState }
  | { type: "replace"; state: ProgressState }
  | { type: "ensure"; slug: string; updatedAt: string }
  | {
      type: "setStatus";
      slug: string;
      nodeId: string;
      status: NodeStatus | null;
      updatedAt: string;
    }
  | { type: "reset"; slug: string; updatedAt: string }
  | { type: "remove"; slug: string };

const EMPTY: ProgressState = {};

const now = () => new Date().toISOString();

function reducer(state: ProgressState, action: Action): ProgressState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "replace": {
      // Ignore no-op external updates (prevents a cross-tab write loop).
      return JSON.stringify(action.state) === JSON.stringify(state)
        ? state
        : action.state;
    }

    case "ensure": {
      if (state[action.slug]) return state; // already tracked
      return {
        ...state,
        [action.slug]: { updatedAt: action.updatedAt, statuses: {} },
      };
    }

    case "setStatus": {
      const entry = state[action.slug] ?? {
        updatedAt: action.updatedAt,
        statuses: {},
      };
      const statuses = { ...entry.statuses };

      if (action.status === null) {
        if (!(action.nodeId in statuses)) return state; // no-op clear
        delete statuses[action.nodeId];
      } else {
        if (statuses[action.nodeId] === action.status) return state; // no-op
        statuses[action.nodeId] = action.status;
      }

      return {
        ...state,
        [action.slug]: { updatedAt: action.updatedAt, statuses },
      };
    }

    case "reset": {
      const entry = state[action.slug];
      if (!entry || Object.keys(entry.statuses).length === 0) return state;
      return {
        ...state,
        [action.slug]: { updatedAt: action.updatedAt, statuses: {} },
      };
    }

    case "remove": {
      if (!(action.slug in state)) return state;
      const next = { ...state };
      delete next[action.slug];
      return next;
    }

    default:
      return state;
  }
}

export interface ProgressContextValue {
  state: ProgressState;
  /** Record that a roadmap was opened (adds a Dashboard card if new). */
  ensure(slug: string): void;
  /** Set or clear (null) a node's status. */
  setStatus(slug: string, nodeId: string, status: NodeStatus | null): void;
  /** Clear every status for a roadmap (keeps the Dashboard card). */
  reset(slug: string): void;
  /** Forget a roadmap entirely (removes its Dashboard card). */
  remove(slug: string): void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

interface ProgressProviderProps {
  children: React.ReactNode;
  /** Injection point for tests or a future backend adapter. */
  adapter?: ProgressAdapter & { flush?: () => void };
}

export function ProgressProvider({ children, adapter }: ProgressProviderProps) {
  const [resolvedAdapter] = useState<ProgressAdapter & { flush?: () => void }>(
    () => adapter ?? debounceAdapter(localStorageAdapter)
  );
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once after mount (never during SSR) so server HTML matches.
  useEffect(() => {
    dispatch({ type: "hydrate", state: resolvedAdapter.read() });
    setHydrated(true);
  }, [resolvedAdapter]);

  // Persist every change (the adapter debounces/batches the actual write).
  useEffect(() => {
    if (!hydrated) return;
    resolvedAdapter.write(state);
  }, [state, hydrated, resolvedAdapter]);

  // Adopt progress written by another tab.
  useEffect(
    () =>
      subscribeExternal(() => {
        dispatch({ type: "replace", state: resolvedAdapter.read() });
      }),
    [resolvedAdapter]
  );

  // Flush any pending debounced write on unmount / tab close.
  useEffect(() => {
    const flush = () => resolvedAdapter.flush?.();
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      resolvedAdapter.flush?.();
    };
  }, [resolvedAdapter]);

  const ensure = useCallback((slug: string) => {
    dispatch({ type: "ensure", slug, updatedAt: now() });
  }, []);

  const setStatus = useCallback(
    (slug: string, nodeId: string, status: NodeStatus | null) => {
      dispatch({ type: "setStatus", slug, nodeId, status, updatedAt: now() });
    },
    []
  );

  const reset = useCallback((slug: string) => {
    dispatch({ type: "reset", slug, updatedAt: now() });
  }, []);

  const remove = useCallback((slug: string) => {
    dispatch({ type: "remove", slug });
  }, []);

  const value = useMemo(
    () => ({ state, ensure, setStatus, reset, remove }),
    [state, ensure, setStatus, reset, remove]
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a <ProgressProvider>");
  }
  return context;
}
