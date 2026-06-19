# Supabase Integration Tests

RLS and visibility tests live in `src/integration/` and run via Vitest's `integration` project.

**No Docker or local Supabase required.** Credentials are read from `.env` / `.env.local`.

## Env vars (in `.env`)

| Variable | Notes |
|----------|--------|
| `SUPABASE_URL` | Or use existing `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Or use existing `VITE_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (never commit) |

Use a **staging** project if possible — tests create ephemeral users and recipes.

## Run (opt-in)

```bash
RUN_INTEGRATION_TESTS=1 npm run test:integration
```

Tests are **skipped by default** in `npm run test:run`.

## Coverage

- Private recipe isolation between users
- Household recipe isolation when users are not in the same household
- Owner can read own private recipes
