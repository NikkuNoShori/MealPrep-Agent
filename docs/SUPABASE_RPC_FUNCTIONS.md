# Supabase RPC Functions

## Overview

This document describes the PostgreSQL functions that are exposed as RPC (Remote Procedure Call) functions in Supabase. These functions can be called directly from the frontend using the Supabase client.

## Available Functions

### 1. `create_or_update_profile`

Creates or updates a user profile.

**Parameters:**
- `p_first_name` (TEXT): User's first name
- `p_last_name` (TEXT): User's last name
- `p_email` (TEXT): User's email

**Returns:**
- Profile object with `id`, `email`, `first_name`, `last_name`, `created_at`, `updated_at`

**Usage:**
```typescript
const { data, error } = await supabase.rpc('create_or_update_profile', {
  p_first_name: 'John',
  p_last_name: 'Doe',
  p_email: 'john@example.com'
});
```

### 2. `get_user_profile`

Gets the current user's profile.

**Parameters:**
- None (uses `auth.uid()` automatically)

**Returns:**
- Profile object with `id`, `email`, `first_name`, `last_name`, `created_at`, `updated_at`

**Usage:**
```typescript
const { data, error } = await supabase.rpc('get_user_profile');
```

### 3. `search_recipes`

Searches recipes with text matching.

**Parameters:**
- `p_search_query` (TEXT, optional): Search query string
- `p_limit` (INTEGER, optional): Maximum number of results (default: 10)

**Returns:**
- Array of recipe objects

**Usage:**
```typescript
const { data, error } = await supabase.rpc('search_recipes', {
  p_search_query: 'chicken',
  p_limit: 10
});
```

## Security

All RPC functions:
- Use `SECURITY DEFINER` to run with elevated privileges
- Check `auth.uid()` to ensure user is authenticated
- Respect RLS policies automatically
- Only return data the user is allowed to access

## Migration

To create these functions, run:

```bash
# Run the migration
node scripts/run-migration.js migrations/017_create_supabase_rpc_functions.sql
```

Or manually in Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `migrations/017_create_supabase_rpc_functions.sql`
3. Click "Run"

## Benefits

1. **Direct Frontend Access**: Call database functions directly from the frontend
2. **Reduced API Surface**: Fewer Express.js endpoints needed
3. **Better Performance**: Functions run in the database, reducing network round-trips
4. **Automatic RLS**: RLS policies are automatically enforced
5. **Type Safety**: Can generate TypeScript types from Supabase schema

## Future Functions

Consider adding RPC functions for:
- Vector/semantic recipe search
- Complex aggregations (recipe statistics, meal planning)
- Batch operations (bulk recipe updates)
- Data validation and sanitization

