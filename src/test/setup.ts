import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach } from 'vitest';
import { server } from './msw/server';
import { supabaseAuthDefaults } from './msw/handlers';

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

// Start MSW at module-load time (not in beforeAll) so the fetch interceptor
// is installed BEFORE test files import api.ts → supabase.ts. supabase-js
// captures globalThis.fetch when the client is constructed; if MSW patches
// fetch later, the captured reference points to the original un-patched
// fetch and requests bypass MSW.
server.listen({ onUnhandledRequest: 'error' });
server.use(...supabaseAuthDefaults);

afterEach(() => {
  cleanup();
  // Reset handlers between tests but keep the auth defaults installed.
  server.resetHandlers(...supabaseAuthDefaults);
});

afterAll(() => {
  server.close();
});
