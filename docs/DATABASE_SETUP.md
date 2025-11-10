# Database Setup Guide

## Overview

This application uses **Supabase** (PostgreSQL) as the database with the following features:
- PostgreSQL with pgvector extension for vector embeddings
- Row Level Security (RLS) for data protection
- Connection pooling for optimal performance

## Initial Setup

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project
3. Note your connection string from **Settings** → **Database** → **Connection string** → **URI**

### 2. Configure Environment Variables

Add to your `.env` file:

```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-[region].pooler.supabase.com:5432/postgres
```

### 3. Enable Required Extensions

Run the setup script to enable required extensions:

```bash
node scripts/setup-supabase.js [your-supabase-connection-string]
```

This will enable:
- `vector` - For pgvector (embedding vectors)
- `uuid-ossp` - For UUID generation
- `pgcrypto` - For cryptographic functions

### 4. Run Database Migrations

Run migrations in order:

```bash
node scripts/run-migration.js migrations/001_initial_schema.sql
node scripts/run-migration.js migrations/002_chat_messages.sql
# ... continue with other migrations
```

Or run all migrations in sequence (check migration order first).

### 5. Set Up Row Level Security (RLS)

Enable RLS on all tables:

```bash
node scripts/setup-rls-supabase.js [your-supabase-connection-string]
```

This will:
- Enable RLS on all tables
- Create helper functions (`get_user_id_from_stack_auth_id`, `set_user_id`)
- Create RLS policies for all tables

## Database Schema

### Core Tables

- **`profiles`** - User profiles (first_name, last_name, email, stack_auth_id)
- **`recipes`** - Recipe storage with vector embeddings
- **`chat_messages`** - Chat conversation history
- **`family_members`** - Family member information
- **`meal_plans`** - Meal planning data
- **`receipts`** - Receipt processing data
- **`user_preferences`** - User preferences and settings

### Key Features

- **Vector Search**: `recipes` table has `embedding_vector` column for semantic search
- **RLS Policies**: All tables have Row Level Security enabled
- **Indexes**: Optimized indexes for common queries
- **Timestamps**: `created_at` and `updated_at` on all tables

## Connection String Formats

### Pooler (Recommended for Serverless)

```
postgresql://postgres.[project-ref]:[password]@aws-[region].pooler.supabase.com:5432/postgres
```

### Direct Connection

```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Note**: Use pooler for serverless functions (Vercel Edge Functions) and direct connection for long-lived connections.

## Database Operations

### Dump Database

```bash
node scripts/dump-database-node.js database-dump.sql
```

### Restore Database

```bash
node scripts/restore-database-node.js database-dump.sql [supabase-connection-string]
```

### Verify Database

```bash
node scripts/verify-supabase.js [supabase-connection-string]
```

## Row Level Security (RLS)

RLS policies ensure users can only access their own data:

- **Profiles**: Users can only view/update their own profile
- **Recipes**: Users can view their own recipes + public recipes
- **Chat Messages**: Users can only view their own messages
- **Other Tables**: Users can only access their own data

### How RLS Works

1. Before each query, call `set_user_id(stack_auth_id)` to set user context
2. RLS policies check `app.current_user_id` session variable
3. Queries are automatically filtered based on user context

See `scripts/setup-rls-supabase.js` for RLS policy details.

## Troubleshooting

### Connection Issues

- **Error**: "Connection refused" or "ENOTFOUND"
  - **Solution**: Verify connection string format and credentials
  - **Check**: Supabase project is active and not paused

### Extension Issues

- **Error**: "extension 'vector' does not exist"
  - **Solution**: Run `scripts/setup-supabase.js` to enable extensions

### RLS Issues

- **Error**: "Permission denied" or queries return no results
  - **Solution**: Ensure `set_user_id()` is called before queries
  - **Check**: RLS policies are enabled via `scripts/setup-rls-supabase.js`

## Next Steps

1. ✅ Database created and configured
2. ✅ Extensions enabled
3. ✅ Migrations run
4. ✅ RLS policies configured
5. ✅ Test database connection
6. ✅ Test RLS policies with authenticated users

