# Supabase Auto-Profile Creation

## Overview

When a user is created in Supabase Auth (`auth.users` table), a profile is automatically created in the `profiles` table via a database trigger. This happens for:

1. **Email/Password Signup**: User signs up with email and password
2. **OAuth Signup**: User signs up with Google OAuth (or other providers)
3. **Magic Link**: User signs in with a magic link
4. **User Invitation**: Admin invites a user via Supabase dashboard

## How It Works

### Database Trigger

A PostgreSQL trigger (`on_auth_user_created`) fires **after** a new user is inserted into `auth.users`:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Trigger Function

The `handle_new_user()` function:

1. **Extracts user metadata** from `auth.users.raw_user_meta_data`:
   - `first_name`: From `raw_user_meta_data->>'first_name'` or extracted from `full_name`
   - `last_name`: From `raw_user_meta_data->>'last_name'` or extracted from `full_name`
   - `email`: From `auth.users.email` or `raw_user_meta_data->>'email'`

2. **Creates profile** in `profiles` table:
   - `id`: Same as `auth.users.id` (UUID)
   - `email`: From user record
   - `first_name`: Extracted from metadata
   - `last_name`: Extracted from metadata
   - `created_at`: Current timestamp
   - `updated_at`: Current timestamp

3. **Handles conflicts**: Uses `ON CONFLICT (id) DO UPDATE` to update existing profiles

## User Metadata Sources

### Email/Password Signup

When user signs up with email/password, metadata is set in `signUp()`:

```typescript
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
    },
  },
})
```

The trigger extracts:
- `first_name`: From `raw_user_meta_data->>'first_name'`
- `last_name`: From `raw_user_meta_data->>'last_name'`
- `email`: From `auth.users.email`

### OAuth Signup (Google)

When user signs up with Google OAuth, Google provides:

```json
{
  "given_name": "John",
  "family_name": "Doe",
  "name": "John Doe",
  "email": "john@example.com"
}
```

The trigger extracts:
- `first_name`: From `raw_user_meta_data->>'given_name'` or `raw_user_meta_data->>'name'` (split)
- `last_name`: From `raw_user_meta_data->>'family_name'` or `raw_user_meta_data->>'name'` (split)
- `email`: From `auth.users.email` or `raw_user_meta_data->>'email'`

### Magic Link

When user signs in with magic link, no metadata is provided. The trigger uses defaults:
- `first_name`: "User"
- `last_name`: ""
- `email`: From `auth.users.email`

### User Invitation

When admin invites a user via Supabase dashboard, metadata can be set in the invitation. The trigger extracts it the same way as email/password signup.

## Migration

To enable auto-profile creation, run:

```bash
node scripts/run-migration.js migrations/018_auto_create_profile_trigger.sql
```

Or manually in Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `migrations/018_auto_create_profile_trigger.sql`
3. Click "Run"

## Verification

### Check Trigger Exists

```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

### Check Trigger Function

```sql
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
```

### Test Auto-Creation

1. Sign up a new user (email/password or OAuth)
2. Check `auth.users` table - user should be created
3. Check `profiles` table - profile should be automatically created

## Code Changes

### Removed Manual Profile Creation

Since profiles are auto-created, we removed manual profile creation from:

1. **`src/services/authService.ts`**:
   - Removed `createProfile()` call from `signUp()`
   - Kept `createProfile()` method for backward compatibility (not used)

2. **`src/pages/OAuthCallback.tsx`**:
   - Removed manual profile creation after OAuth
   - Profile is automatically created by trigger

3. **`server.js`**:
   - `POST /api/profile` endpoint still exists for manual profile updates
   - `GET /api/profile` endpoint auto-creates profile if missing (fallback)

## Benefits

1. **Automatic**: No need to manually create profiles
2. **Consistent**: All users get profiles automatically
3. **Reliable**: Database trigger ensures profile creation
4. **Simple**: Less code to maintain

## Fallback

If the trigger fails or profile doesn't exist, the `GET /api/profile` endpoint will auto-create a profile as a fallback:

```javascript
// server.js - GET /api/profile
if (!result || result.rows.length === 0) {
  // Auto-create profile if it doesn't exist (fallback)
  result = await db.query(
    `INSERT INTO profiles (id, email, first_name, last_name, ...)
     VALUES ($1, $2, $3, $4, ...)
     ON CONFLICT (id) DO UPDATE ...
     RETURNING ...`,
    [user.id, userEmail, 'User', '']
  );
}
```

## Troubleshooting

### Profile Not Created

**Check**:
1. Trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
2. Trigger function exists: `SELECT * FROM pg_proc WHERE proname = 'handle_new_user';`
3. User exists in `auth.users`: `SELECT * FROM auth.users WHERE id = 'user-id';`
4. Check trigger logs: Look for errors in Supabase logs

**Solution**:
- Run migration: `migrations/018_auto_create_profile_trigger.sql`
- Check trigger function for errors
- Verify RLS policies allow trigger to insert into `profiles` table

### Profile Created with Wrong Data

**Check**:
1. User metadata in `auth.users.raw_user_meta_data`
2. Trigger function extraction logic

**Solution**:
- Update trigger function to extract correct fields
- Check OAuth provider metadata format
- Update `signUp()` to set correct metadata

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/triggers.html)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)

