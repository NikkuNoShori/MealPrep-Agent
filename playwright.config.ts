import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load test credentials from .env.test (local dev only — CI injects secrets via env vars)
if (!process.env.CI) {
  dotenv.config({ path: path.resolve(__dirname, '.env.test') });
}

/**
 * MOP-0013 — Playwright E2E configuration.
 *
 * Run:
 *   npm run dev          # separate terminal (or set PLAYWRIGHT_SKIP_WEBSERVER=1 if already running)
 *   npm run test:e2e
 *   npm run test:e2e:ui  # interactive UI mode
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,    // serial — tests share one Supabase account
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || (process.env.PLAYWRIGHT_SKIP_WEBSERVER ? 'http://localhost:4173' : 'http://localhost:5173'),
    storageState: './e2e/.auth/user.json',   // every test starts authenticated
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? {
        // CI: serve the pre-built production bundle via vite preview (port 4173)
        command: 'npm run preview -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : {
        // Local dev: start vite dev server
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
        },
      },
});
