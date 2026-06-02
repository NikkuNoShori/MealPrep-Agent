import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';
import { supabaseAuthDefaults } from './msw/handlers';

// Vitest 4 exposes lifecycle hooks as globals when `globals: true` is set in
// vite.config.ts. Importing them from "vitest" at the top of a setupFile
// caused "Vitest failed to find the runner" — referencing the globals from
// `globalThis` here avoids touching the import-time eager defaults inside
// @vitest/runner.

// supabase-js v2 calls storage.getItem at module-load time when
// persistSession is enabled. jsdom provides a localStorage but supabase-js
// hands the storage reference around in ways that lose `this`, so we
// install a self-bound in-memory shim before any module imports run.
const memoryStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: memoryStorage,
  writable: true,
  configurable: true,
});

// Start MSW at module-load time (NOT inside beforeAll). supabase-js captures
// `globalThis.fetch` eagerly inside `SupabaseClient`'s constructor when
// `apiClient` imports `./supabase`. If we waited for beforeAll, the supabase
// client would have already captured the un-patched fetch and every PostgREST
// call would bypass MSW with "fetch failed". setupFiles' module bodies run
// before test files' imports, so calling listen() here guarantees MSW patches
// `fetch` first.
server.listen({ onUnhandledRequest: 'error' });
server.use(...supabaseAuthDefaults);

// Type-only handles for the Vitest hook globals injected by `globals: true`.
type Hook = (fn: () => void | Promise<void>) => void;
const g = globalThis as unknown as {
  afterEach: Hook;
  afterAll: Hook;
};

g.afterEach(() => {
  cleanup();
  // Reset handlers between tests but keep the auth defaults installed.
  server.resetHandlers(...supabaseAuthDefaults);
});

g.afterAll(() => {
  server.close();
});
