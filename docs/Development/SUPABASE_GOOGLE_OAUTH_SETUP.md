# Supabase Google OAuth Setup

## Overview

This guide explains how to configure Google OAuth in Supabase for the MealPrep Agent application.

## Prerequisites

1. Google Cloud Console project with OAuth 2.0 credentials
2. Supabase project
3. Google OAuth client ID and secret

## Step 1: Configure Google OAuth in Google Cloud Console

### 1.1 Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Configure:
   - **Name**: `MealPrep Agent - Supabase`
   - **Authorized JavaScript origins**:
     - `https://[your-project-ref].supabase.co`
     - `http://localhost:5173` (for local development)
   - **Authorized redirect URIs**:
     - `https://[your-project-ref].supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (for local development)

### 1.2 Get Client ID and Secret

1. Copy the **Client ID** (e.g., `[your-client-id].apps.googleusercontent.com`)
2. Copy the **Client Secret** (e.g., `[your-client-secret]`)
3. Save these for Step 2

### 1.3 Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Configure:
   - **User Type**: External (or Internal if using Google Workspace)
   - **App name**: `MealPrep Agent`
   - **User support email**: Your email
   - **Developer contact information**: Your email
   - **Scopes**: 
     - `email`
     - `profile`
     - `openid`

## Step 2: Configure Google OAuth in Supabase

### 2.1 Enable Google Provider

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click **Enable**

### 2.2 Add OAuth Credentials

1. In the Google provider settings:
   - **Client ID (for OAuth)**: Paste your Google Client ID
   - **Client Secret (for OAuth)**: Paste your Google Client Secret
2. Click **Save**

### 2.3 Configure Redirect URLs

Supabase automatically handles redirect URLs. The format is:
```
https://[your-project-ref].supabase.co/auth/v1/callback
```

Make sure this URL is in your Google Cloud Console **Authorized redirect URIs**.

### 2.4 Configure Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your frontend URL:
   - Production: `https://your-domain.com`
   - Development: `http://localhost:5173`
3. Add **Redirect URLs**:
   - `http://localhost:5173/**` (for local development)
   - `https://your-domain.com/**` (for production)

## Step 3: Update Frontend Code

### 3.1 Sign In with Google

The frontend code is already configured to use Supabase OAuth:

```typescript
// src/services/authService.ts
async signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  
  if (error) throw error;
  return data;
}
```

### 3.2 Handle OAuth Callback

The `OAuthCallback.tsx` component handles the callback:

```typescript
// src/pages/OAuthCallback.tsx
const { data: { session }, error: sessionError } = await supabase.auth.getSession();

if (session?.user) {
  // Profile is automatically created by database trigger
  // No need to manually create profile
}
```

## Step 4: Verify Auto-Profile Creation

### 4.1 Check Database Trigger

The trigger `on_auth_user_created` automatically creates a profile when a user signs up:

```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check trigger function
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
```

### 4.2 Test OAuth Flow

1. Click "Sign in with Google" in your app
2. Complete Google OAuth flow
3. Check `auth.users` table - user should be created
4. Check `profiles` table - profile should be auto-created

## Step 5: Configure Email Templates (Optional)

Supabase uses its own email templates for:
- Magic links
- Email verification
- Password reset
- User invitations

### 5.1 Customize Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize templates:
   - **Confirm signup**: Email verification
   - **Magic Link**: Passwordless login
   - **Change Email Address**: Email change confirmation
   - **Reset Password**: Password reset
   - **Invite user**: User invitation

### 5.2 Email Template Variables

Available variables:
- `{{ .ConfirmationURL }}` - Confirmation link
- `{{ .Email }}` - User email
- `{{ .Token }}` - Verification token
- `{{ .TokenHash }}` - Token hash
- `{{ .SiteURL }}` - Site URL
- `{{ .RedirectTo }}` - Redirect URL

## Step 6: Test OAuth Flow

### 6.1 Local Development

1. Start your app: `npm run dev`
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify user is created in `auth.users`
5. Verify profile is created in `profiles`

### 6.2 Production

1. Deploy your app
2. Update Google Cloud Console redirect URIs
3. Update Supabase Site URL
4. Test OAuth flow

## Troubleshooting

### Issue: "Redirect URI mismatch"

**Solution**: 
- Check Google Cloud Console **Authorized redirect URIs**
- Must include: `https://[your-project-ref].supabase.co/auth/v1/callback`

### Issue: "Profile not created after OAuth"

**Solution**:
- Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Run migration: `migrations/018_auto_create_profile_trigger.sql`
- Check trigger function: `SELECT * FROM pg_proc WHERE proname = 'handle_new_user';`

### Issue: "OAuth callback not working"

**Solution**:
- Check Supabase **Site URL** configuration
- Check **Redirect URLs** in Supabase
- Verify frontend callback route: `/auth/callback`

### Issue: "User metadata not extracted"

**Solution**:
- Check `auth.users.raw_user_meta_data` for OAuth data
- Update trigger function to extract correct fields
- Google OAuth provides: `given_name`, `family_name`, `name`, `email`

## Security Notes

1. **Client Secret**: Never expose in frontend code
2. **Redirect URLs**: Only allow trusted domains
3. **Site URL**: Set to your production domain
4. **RLS Policies**: Ensure profiles table has proper RLS policies

## Next Steps

1. ✅ Configure Google OAuth in Supabase
2. ✅ Test OAuth flow
3. ✅ Verify auto-profile creation
4. ✅ Customize email templates (optional)
5. ✅ Deploy to production

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)

