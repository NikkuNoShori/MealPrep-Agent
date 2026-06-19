/**
 * Resolve Supabase credentials for opt-in integration tests.
 * No local Supabase / Docker — reads from `.env` / `.env.local` only.
 */
export interface IntegrationSupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function resolveIntegrationConfig(): IntegrationSupabaseConfig {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Integration tests require SUPABASE_URL (or VITE_SUPABASE_URL), ' +
        'SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY), and ' +
        'SUPABASE_SERVICE_ROLE_KEY in .env — no local Supabase/Docker needed.'
    );
  }

  return { url, anonKey, serviceRoleKey };
}
