/** Shared React Query cache timings (ms). */
export const QUERY_STALE_TIME = {
  /** Recipes, meal plans, preferences — stable until mutated. */
  domain: 5 * 60 * 1000,
  /** Typeahead / search — fresher results. */
  search: 30 * 1000,
  /** Chat conversation list — invalidated on send/persist. */
  chatHistory: 2 * 60 * 1000,
} as const;
