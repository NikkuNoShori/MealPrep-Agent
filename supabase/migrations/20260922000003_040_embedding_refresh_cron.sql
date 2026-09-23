-- Schedule embedding-refresh edge function via pg_cron + pg_net.
--
-- The embedding-refresh function polls recipes.needs_reembed = true and generates
-- fresh embeddings. Auth is handled by Supabase JWT verification (verify_jwt: true)
-- on the function — the cron job passes a service-role JWT so Supabase validates it
-- before the function code runs.
--
-- The service role key is stored in Vault (never in this file) under 'service_role_key'.
-- Store it once via SQL Editor: select vault.create_secret('<key>', 'service_role_key');
--
-- Prerequisites (already enabled):
--   create extension if not exists pg_cron with schema extensions;
--   create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'embedding-refresh',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url     := 'https://tiibvcgnxnpgvygmqzvu.supabase.co/functions/v1/embedding-refresh',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'service_role_key'
        limit 1
      )
    ),
    body    := '{}'::jsonb
  ) as request_id;
  $job$
);
