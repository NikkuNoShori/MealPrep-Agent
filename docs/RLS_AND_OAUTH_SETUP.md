# RLS and OAuth Setup for Supabase

## Overview

This document explains how Row Level Security (RLS) and OAuth are configured in Supabase for the MealPrep Agent application.

## Key Points

1. **Auto-Profile Creation**: When a user is created in `auth.users` (via signup, OAuth, magic link, or invitation), a profile is automatically created in the `profiles` table via a database trigger.

2. **RLS Policies**: All tables use Supabase's `auth.uid()` function for RLS, which automatically uses the authenticated user's ID from Supabase Auth.

3. **OAuth**: Google OAuth is configured in Supabase Dashboard. See `SUPABASE_GOOGLE_OAUTH_SETUP.md` for detailed setup instructions.

## Row Level Security (RLS)

### How RLS Works

1. **Automatic User Context**: Supabase Auth automatically sets `auth.uid()` in the session context when a user is authenticated.

2. **RLS Policies**: All tables have RLS policies that use `auth.uid()`:
   ```sql
   CREATE POLICY "Users can view own recipes" ON recipes
     FOR SELECT USING (user_id = auth.uid() OR is_public = true);
   ```

3. **No Manual Setup**: Unlike custom session variables, `auth.uid()` is automatically available - no need to call `set_user_id()`.

### RLS Policies

All tables have RLS policies for:
- **SELECT**: Users can view their own data (recipes also allow public viewing)
- **INSERT**: Users can only insert data with their own `user_id`
- **UPDATE**: Users can only update their own data
- **DELETE**: Users can only delete their own data

### Migration

RLS policies are set up in migration `016_update_rls_for_supabase_auth.sql`:

```bash
node scripts/run-migration.js migrations/016_update_rls_for_supabase_auth.sql
```

## OAuth Setup

### Google OAuth Configuration

1. **Google Cloud Console**:
   - Create OAuth 2.0 credentials
   - Add redirect URI: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - Get Client ID and Client Secret

2. **Supabase Dashboard**:
   - Go to **Authentication** → **Providers**
   - Enable **Google** provider
   - Add Client ID and Client Secret
   - Save configuration

3. **Frontend**:
   - Already configured in `src/services/authService.ts`
   - Uses `supabase.auth.signInWithOAuth({ provider: 'google' })`

### OAuth Flow

1. User clicks "Sign in with Google"
2. Redirects to Google OAuth consent screen
3. After authorization, redirects to Supabase callback
4. Supabase creates user in `auth.users` table
5. Database trigger automatically creates profile in `profiles` table
6. User is signed in and redirected to dashboard

### Detailed Setup

See `SUPABASE_GOOGLE_OAUTH_SETUP.md` for complete setup instructions.

## Auto-Profile Creation

### Database Trigger

A PostgreSQL trigger automatically creates a profile when a user is created:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Trigger Function

The `handle_new_user()` function:
1. Extracts `first_name` and `last_name` from user metadata
2. Creates profile in `profiles` table
3. Handles conflicts with `ON CONFLICT DO UPDATE`

### Migration

Auto-profile creation is set up in migration `018_auto_create_profile_trigger.sql`:

```bash
node scripts/run-migration.js migrations/018_auto_create_profile_trigger.sql
```

### Detailed Documentation

See `SUPABASE_AUTO_PROFILE_CREATION.md` for complete documentation.

## Email Templates

Supabase uses its own email templates for:
- **Magic Links**: Passwordless login
- **Email Verification**: Email confirmation
- **Password Reset**: Password reset links
- **User Invitations**: Admin-invited users

### Customize Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize templates:
   - **Confirm signup**: Email verification
   - **Magic Link**: Passwordless login
   - **Change Email Address**: Email change confirmation
   - **Reset Password**: Password reset
   - **Invite user**: User invitation

### Email Template Variables

Available variables:
- `{{ .ConfirmationURL }}` - Confirmation link
- `{{ .Email }}` - User email
- `{{ .Token }}` - Verification token
- `{{ .TokenHash }}` - Token hash
- `{{ .SiteURL }}` - Site URL
- `{{ .RedirectTo }}` - Redirect URL

## Testing Checklist

### RLS Testing

- [ ] Test that users can only see their own recipes
- [ ] Test that users can only modify their own recipes
- [ ] Test that public recipes are visible to unauthenticated users
- [ ] Test that users can only see their own chat messages
- [ ] Test that users can only see their own profiles

### OAuth Testing

- [ ] Test Google OAuth sign in flow
- [ ] Test Google OAuth sign up flow
- [ ] Verify user is created in `auth.users` after OAuth
- [ ] Verify profile is auto-created in `profiles` after OAuth
- [ ] Verify user can access protected routes after OAuth
- [ ] Test OAuth error handling

### Auto-Profile Creation Testing

- [ ] Test profile creation on email/password signup
- [ ] Test profile creation on OAuth signup
- [ ] Test profile creation on magic link signup
- [ ] Test profile creation on user invitation
- [ ] Verify profile data is extracted correctly from metadata

## Next Steps

1. ✅ **Run RLS Migration**: `migrations/016_update_rls_for_supabase_auth.sql`
2. ✅ **Run Auto-Profile Trigger Migration**: `migrations/018_auto_create_profile_trigger.sql`
3. ✅ **Configure Google OAuth**: See `SUPABASE_GOOGLE_OAUTH_SETUP.md`
4. ✅ **Test OAuth Flow**: Test complete OAuth flow end-to-end
5. ✅ **Customize Email Templates**: (Optional) Customize Supabase email templates

## Documentation

- **RLS Setup**: `migrations/016_update_rls_for_supabase_auth.sql`
- **OAuth Setup**: `docs/SUPABASE_GOOGLE_OAUTH_SETUP.md`
- **Auto-Profile Creation**: `docs/SUPABASE_AUTO_PROFILE_CREATION.md`
- **This Summary**: `docs/RLS_AND_OAUTH_SETUP.md`
