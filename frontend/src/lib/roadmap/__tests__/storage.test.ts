import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  STORAGE_KEY,
  debounceAdapter,
  localStorageAdapter,
} from "@/lib/roadmap/storage";
import type { ProgressState } from "@/types/roadmap";

const STATE: ProgressState = {
  "software-engineer": {
    updatedAt: "2026-01-01T00:00:00.000Z",
    statuses: { html: "done", css: "learning" },
  },
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("localStorageAdapter", () => {
  it("round-trips state through localStorage", () => {
    localStorageAdapter.write(STATE);
    expect(localStorageAdapter.read()).toEqual(STATE);
  });

  it("returns an empty state when nothing is stored", () => {
    expect(localStorageAdapter.read()).toEqual({});
  });

  it("drops corrupt JSON instead of crashing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json!");
    expect(localStorageAdapter.read()).toEqual({});
    // and the corrupt key is cleared
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("drops wrong-shaped JSON instead of crashing", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ bad: { statuses: "nope" } }));
    expect(localStorageAdapter.read()).toEqual({});
  });
});

describe("debounceAdapter", () => {
  it("batches writes and flush pushes them to the base immediately", () => {
    let written: ProgressState | null = null;
    const base = {
      read: () => ({}),
      write: (state: ProgressState) => {
        written = state;
      },
    };
    const debounced = debounceAdapter(base, 10_000);

    debounced.write(STATE);
    expect(written).toBeNull(); // still pending

    debounced.flush();
    expect(written).toEqual(STATE);
  });

  it("debounces rapid writes into one", () => {
    let writes = 0;
    const base = { read: () => ({}), write: () => (writes += 1) };
    const debounced = debounceAdapter(base, 10_000);

    debounced.write(STATE);
    debounced.write(STATE);
    debounced.write(STATE);
    debounced.flush();

    expect(writes).toBe(1);
  });
});

describe("degraded localStorage", () => {
  it("falls back to memory and never throws when writes fail", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    } as unknown as Storage;

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: throwing,
    });

    // First write probes storage (throws) → falls back to memory, no throw.
    expect(() => localStorageAdapter.write(STATE)).not.toThrow();
    expect(localStorageAdapter.read()).toEqual(STATE);

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      ...(original as PropertyDescriptor),
    });
  });
});
