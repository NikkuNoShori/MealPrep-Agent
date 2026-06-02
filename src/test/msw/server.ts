import { setupServer } from 'msw/node';

// Shared MSW server used across all tests. Per-test handlers are added with
// `server.use(...)` and reset between tests in src/test/setup.ts.
export const server = setupServer();
