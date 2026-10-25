import { progressStateSchema } from "@/types/roadmap";
import type { ProgressState } from "@/types/roadmap";

/**
 * Storage abstraction for roadmap progress.
 *
 * The store depends only on the `ProgressAdapter` interface, so a backend
 * (HTTP) adapter can be dropped in later without touching any component. The
 * default adapter is localStorage-backed but is deliberately defensive:
 *
 *  - localStorage unavailable (SSR / privacy mode) → in-memory fallback
 *  - quota exceeded on write → keeps the state in memory, never throws
 *  - corrupt / wrong-shaped JSON on read → dropped, returns an empty state
 *  - debounced writes so rapid status clicks are batched
 *  - a `storage`-event subscription for multi-tab synchronisation
 */

export interface ProgressAdapter {
  read(): ProgressState;
  write(state: ProgressState): void;
}

export const STORAGE_KEY = "cm_roadmap_progress_v1";
const SAVE_DEBOUNCE_MS = 250;

/** True once localStorage has proven unusable this session. */
let storageBroken = false;
/** Last state written (or read), used when localStorage is unusable. */
let memoryState: ProgressState = {};

function getStorage(): Storage | null {
  if (storageBroken) return null;
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    // Safari private mode throws on write; probe before trusting it.
    const probe = `${STORAGE_KEY}__probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    storageBroken = true;
    return null;
  }
}

function readProgressState(storage: Storage): ProgressState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    const result = progressStateSchema.safeParse(parsed);
    if (!result.success) {
      // Wrong shape (older/corrupt key) — clear it and start clean.
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return {};
    }
    return result.data;
  } catch {
    // Corrupt JSON — clear it and start clean rather than crash.
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return {};
  }
}

/**
 * Resilient localStorage adapter. Falls back to an in-memory copy as soon as
 * localStorage misbehaves (read or write), so the UI keeps working.
 */
export const localStorageAdapter: ProgressAdapter = {
  read(): ProgressState {
    const storage = getStorage();
    if (!storage) return memoryState;
    memoryState = readProgressState(storage);
    return memoryState;
  },

  write(state: ProgressState): void {
    memoryState = state;
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded (or otherwise unwritable) — degrade to memory-only.
      storageBroken = true;
    }
  },
};

/**
 * Wraps an adapter so writes are debounced/batched. `flush` forces any pending
 * write immediately (used on unmount / beforeunload and by tests).
 */
export function debounceAdapter(
  base: ProgressAdapter,
  delayMs = SAVE_DEBOUNCE_MS
): ProgressAdapter & { flush(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: ProgressState | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending !== null) {
      const state = pending;
      pending = null;
      base.write(state);
    }
  };

  return {
    read: () => base.read(),
    write(state: ProgressState) {
      pending = state;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}

/**
 * Subscribe to progress written by other tabs. Returns an unsubscribe function
 * that is safe to call on the server (where there is no `window`).
 */
export function subscribeExternal(onExternal: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: StorageEvent) => {
    // `event.key === null` means a full `storage.clear()`.
    if (event.key === null || event.key === STORAGE_KEY) onExternal();
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
