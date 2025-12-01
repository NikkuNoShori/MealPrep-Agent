# How to Get Your Supabase PostgreSQL Connection String

To restore your database dump to Supabase, you need the **PostgreSQL connection string**, not the Supabase URL and anon key.

## Steps to Get Your Supabase Connection String

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project: `vcovstjdevclkxxkiwic`

2. **Navigate to Database Settings**
   - Click on **Settings** (gear icon) in the left sidebar
   - Click on **Database** in the settings menu

3. **Get Connection String**
   - Scroll down to **Connection string** section
   - Select **URI** tab (not "Session mode" or "Transaction mode")
   - Copy the connection string
   - It should look like:
     ```
     postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```

4. **Alternative: Connection Pooling**
   - If you see "Connection pooling", you can use that instead
   - It will look like:
     ```
     postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```

## Important Notes

- **Password**: You'll need your database password. If you forgot it, you can reset it in the Supabase dashboard
- **Connection Pooling**: Supabase uses connection pooling by default (port 6543). This is recommended for most applications
- **Direct Connection**: If you need a direct connection (port 5432), you can use that, but connection pooling is usually better

## Example Connection String Format

```
postgresql://postgres.vcovstjdevclkxxkiwic:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

Replace `[YOUR-PASSWORD]` with your actual database password.

## After Getting the Connection String

Once you have the connection string, you can restore the database:

```bash
node scripts/restore-database-node.js database-dump.sql "your-connection-string-here"
```

Or set it in your `.env` file as `DATABASE_URL` and run:

```bash
node scripts/restore-database-node.js database-dump.sql
```

