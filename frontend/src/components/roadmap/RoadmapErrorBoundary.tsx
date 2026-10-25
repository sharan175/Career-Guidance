"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a failed roadmap load (bad data, missing registry entry) and shows a
 * friendly message with a retry instead of crashing the whole app.
 */
export class RoadmapErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <h2 className="text-lg font-bold text-rose-900">This roadmap failed to load</h2>
          <p className="mt-2 break-words text-sm text-rose-800">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
