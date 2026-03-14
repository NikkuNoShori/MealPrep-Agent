import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createAuthenticatedClient(userToken: string): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: `Bearer ${userToken}` },
    },
  });
}

export async function getUserFromToken(
  token: string
): Promise<{ user: any; supabase: SupabaseClient } | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const tempClient = createClient(supabaseUrl, supabaseKey);
  const {
    data: { user },
    error,
  } = await tempClient.auth.getUser(token);

  if (error || !user) return null;

  const supabase = createAuthenticatedClient(token);
  return { user, supabase };
}

/** Service-role client that bypasses RLS. Use only in edge functions for admin operations. */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
