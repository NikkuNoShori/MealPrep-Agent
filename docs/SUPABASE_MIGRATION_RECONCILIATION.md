# Supabase Migration Reconciliation Guide

## Overview

This guide explains how to reconcile your migration history with Supabase CLI format. Supabase CLI uses a specific naming convention: `YYYYMMDDHHMMSS_description.sql`

## Current Situation

- Migrations were created manually (not using Supabase CLI)
- Migration files use format: `001_description.sql`
- Need to convert to Supabase CLI format: `YYYYMMDDHHMMSS_description.sql`
- Need to ensure migrations are properly structured

## Step 1: Reconcile Migration Files

### Run the Reconciliation Script

```bash
node scripts/reconcile-supabase-migrations.js
```

This script will:
1. Create `supabase/migrations/` directory if it doesn't exist
2. Copy all migrations to `supabase/migrations/` with proper naming
3. Generate a reconciliation report
4. Verify migration structure

### What the Script Does

- **Renames migrations** to Supabase CLI format:
  - `001_initial_schema.sql` → `20240101000000_initial_schema.sql`
  - `016_update_rls_for_supabase_auth.sql` → `20250127000000_update_rls_for_supabase_auth.sql`
  - etc.

- **Preserves original files** in `migrations/` directory
- **Creates new files** in `supabase/migrations/` directory

## Step 2: Verify Migration Structure

### Run the Verification Script

```bash
node scripts/verify-supabase-migrations.js
```

This script checks:
- ✅ BEGIN/COMMIT transactions
- ✅ IF EXISTS for DROP statements
- ✅ Proper SQL syntax
- ✅ Idempotency (CREATE OR REPLACE, IF NOT EXISTS)

## Step 3: Check Supabase Migration History

### Connect to Supabase Database

```bash
supabase db connect
```

Or use your connection string:
```bash
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
```

### Check Migration History

```sql
-- Check which migrations have been applied
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version;
```

### If Migrations Were Already Applied

If your migrations were already applied manually (not via Supabase CLI), you need to mark them as applied:

```sql
-- Insert migration history (adjust dates/times to match your actual migration dates)
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20240101000000', 'initial_schema'),
  ('20240102000000', 'chat_messages'),
  ('20240103000000', 'create_missing_tables'),
  ('20240104000000', 'add_test_user'),
  ('20240105000000', 'drop_chat_messages'),
  ('20240106000000', 'drop_unused_tables'),
  ('20240107000000', 'create_recipes_table'),
  ('20240108000000', 'add_rag_support'),
  ('20240108000100', 'enable_rls_recipes'),
  ('20240109000000', 'add_semantic_search_functions'),
  ('20240109000100', 'fix_rls_for_stack_auth'),
  ('20240110000000', 'add_is_public_to_recipes'),
  ('20240111000000', 'update_rls_for_public_recipes'),
  ('20240112000000', 'add_slug_to_recipes'),
  ('20240113000000', 'rename_users_to_profiles'),
  ('20240114000000', 'fix_profiles_table_schema'),
  ('20240115000000', 'add_uuid_support_to_profiles'),
  ('20250127000000', 'update_rls_for_supabase_auth'),
  ('20250127000100', 'create_supabase_rpc_functions'),
  ('20250127000200', 'auto_create_profile_trigger')
ON CONFLICT (version) DO NOTHING;
```

## Step 4: Test Migrations

### Option A: Reset Database (Development Only)

⚠️ **WARNING**: This will delete all data!

```bash
supabase db reset
```

This will:
1. Drop all tables
2. Run all migrations in order
3. Apply seed data (if any)

### Option B: Apply New Migrations Only

```bash
supabase migration up
```

This will:
1. Check which migrations have been applied
2. Apply only new migrations
3. Update migration history

## Step 5: Verify Database State

### Check Tables

```sql
-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Check Functions

```sql
-- List all functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;
```

### Check RLS Policies

```sql
-- List all RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

### Check Triggers

```sql
-- List all triggers
SELECT trigger_name, event_object_table, action_statement 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table, trigger_name;
```

## Migration File Format

### Supabase CLI Format

```
YYYYMMDDHHMMSS_description.sql
```

Example:
- `20240101000000_initial_schema.sql`
- `20250127000000_update_rls_for_supabase_auth.sql`

### Required Structure

```sql
-- Migration: Description
-- Date: YYYY-MM-DD
-- Description: What this migration does

BEGIN;

-- Your SQL statements here

COMMIT;
```

### Best Practices

1. **Always use transactions**: Wrap in BEGIN/COMMIT
2. **Use IF EXISTS**: For DROP statements
3. **Use CREATE OR REPLACE**: For functions
4. **Use IF NOT EXISTS**: For tables/views
5. **Add comments**: Explain what the migration does
6. **Test idempotency**: Migration should be safe to run multiple times

## Troubleshooting

### Issue: "Migration already applied"

**Solution**: Mark migration as applied in `supabase_migrations.schema_migrations` table

### Issue: "Migration failed"

**Solution**: 
1. Check migration file for syntax errors
2. Run verification script: `node scripts/verify-supabase-migrations.js`
3. Fix issues and re-run migration

### Issue: "Migration history out of sync"

**Solution**: 
1. Check current migration history: `SELECT * FROM supabase_migrations.schema_migrations;`
2. Compare with actual database state
3. Manually insert missing migration records

### Issue: "RLS policies not working"

**Solution**:
1. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
2. Check policies: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
3. Verify `auth.uid()` is available: `SELECT auth.uid();`

## Next Steps

1. ✅ Run reconciliation script
2. ✅ Verify migration structure
3. ✅ Check Supabase migration history
4. ✅ Mark existing migrations as applied (if needed)
5. ✅ Test migrations with `supabase db reset` (development)
6. ✅ Use `supabase migration up` for new migrations

## References

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)

