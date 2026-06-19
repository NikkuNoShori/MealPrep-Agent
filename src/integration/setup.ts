/**
 * Integration test setup — intentionally does NOT start MSW.
 *
 * Opt-in only (`RUN_INTEGRATION_TESTS=1`). Loads `.env` then `.env.local`
 * so hosted Supabase credentials work without Docker or `supabase start`.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

if (process.env.RUN_INTEGRATION_TESTS === '1') {
  loadEnv({ path: resolve(process.cwd(), '.env') });
  loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
}
