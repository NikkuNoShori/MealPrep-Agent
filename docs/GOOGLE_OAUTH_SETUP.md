# Google OAuth Authentication Setup Guide

## Overview

Google OAuth authentication has been fully implemented in the MealPrep Agent application. This document outlines what has been implemented and what you need to configure in your Supabase project.

## What Has Been Implemented

### 1. **Auth Service** (`src/services/supabase.ts`)
- ✅ `signInWithGoogle()` - Sign in or sign up with Google OAuth
- ✅ `linkGoogleAccount()` - Link Google account to existing email/password account
- ✅ `unlinkGoogleAccount()` - Unlink Google account from user profile
- ✅ `getLinkedAccounts()` - Get all linked authentication providers
- ✅ `handleOAuthCallback()` - Handle OAuth callback and create/update user profile

### 2. **Auth Store** (`src/stores/authStore.ts`)
- ✅ Added `signInWithGoogle()` method to store
- ✅ Added `linkGoogleAccount()` method to store
- ✅ Added `unlinkGoogleAccount()` method to store
- ✅ Added `loadLinkedAccounts()` method to store
- ✅ Added `linkedAccounts` state to track connected providers
- ✅ Automatically loads linked accounts on user initialization

### 3. **UI Components**
- ✅ **LoginForm** - Added "Sign in with Google" button
- ✅ **SignupForm** - Added "Sign up with Google" button
- ✅ **Settings Page** - Added account management section with:
  - Display of connected accounts (Email/Password and Google)
  - Link/Unlink Google account buttons
  - Protection against unlinking if it's the only auth method

### 4. **OAuth Callback Handler**
- ✅ Created `AuthCallback` page component (`src/pages/AuthCallback.tsx`)
- ✅ Added route `/auth/callback` in `App.tsx`
- ✅ Handles OAuth redirect and updates user state

## Database Requirements

**No database migration is required!** 

Supabase automatically handles OAuth providers in the `auth.users` table. The `auth.users.identities` field stores all linked authentication providers for each user. The existing `profiles` table trigger will automatically create/update user profiles when OAuth users sign in.

The current database schema already supports:
- ✅ `auth.users` table (managed by Supabase) - stores OAuth identities
- ✅ `profiles` table - stores user profile data linked to `auth.users.id`
- ✅ Automatic profile creation trigger on new user signup

## Supabase Configuration Required

### Step 1: Enable Google OAuth Provider

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list and click to enable it
4. You'll need to configure Google OAuth credentials (see Step 2)

### Step 2: Configure Google OAuth Credentials

#### A. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure the OAuth consent screen if prompted:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in required information (App name, User support email, Developer contact)
   - Add scopes: `email`, `profile`, `openid`
6. Create OAuth client:
   - Application type: **Web application**
   - Name: Your app name (e.g., "MealPrep Agent")
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for local development)
     - `https://your-production-domain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:5173/auth/callback` (for local development)
     - `https://your-supabase-project.supabase.co/auth/v1/callback` (Supabase callback)
     - `https://your-production-domain.com/auth/callback` (for production)

#### B. Add Credentials to Supabase

1. Copy your **Client ID** and **Client Secret** from Google Cloud Console
2. In Supabase Dashboard → **Authentication** → **Providers** → **Google**
3. Paste:
   - **Client ID (for OAuth)**: Your Google OAuth Client ID
   - **Client Secret (for OAuth)**: Your Google OAuth Client Secret
4. Click **Save**

### Step 3: Configure Redirect URLs

In Supabase Dashboard → **Authentication** → **URL Configuration**:

1. **Site URL**: Your production domain (e.g., `https://your-app.com`)
2. **Redirect URLs**: Add these URLs:
   - `http://localhost:5173/auth/callback` (local development)
   - `https://your-production-domain.com/auth/callback` (production)
   - `https://your-supabase-project.supabase.co/auth/v1/callback` (Supabase default)

### Step 4: Environment Variables

Ensure your `.env` file (or environment variables) includes:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These should already be configured if you're using Supabase authentication.

## How It Works

### Sign In/Sign Up Flow

1. User clicks "Sign in with Google" or "Sign up with Google"
2. User is redirected to Google OAuth consent screen
3. After consent, Google redirects to Supabase callback URL
4. Supabase processes the OAuth token and creates/updates user in `auth.users`
5. Supabase redirects to your app's `/auth/callback` route
6. Your app handles the callback, creates/updates profile, and redirects to dashboard

### Account Linking Flow

1. User signs in with email/password
2. User goes to Settings → Account section
3. User clicks "Link" next to Google account
4. User is redirected to Google OAuth consent screen
5. If Google email matches the account email, Supabase automatically links the accounts
6. User is redirected back to Settings with Google account now linked

### Account Unlinking Flow

1. User must have at least one other auth method (email/password)
2. User goes to Settings → Account section
3. User clicks "Unlink" next to Google account
4. Confirmation dialog appears
5. After confirmation, Google identity is removed from user's account
6. User can still sign in with email/password

## Testing

### Local Development

1. Start your development server
2. Navigate to `/signin` or `/signup`
3. Click "Sign in with Google" or "Sign up with Google"
4. Complete Google OAuth flow
5. You should be redirected to `/dashboard` after successful authentication

### Verify Account Linking

1. Sign in with email/password
2. Go to `/settings`
3. Check the "Account" section
4. You should see both "Email & Password" and "Google" accounts listed
5. Click "Link" next to Google to link your Google account
6. After linking, the button should change to "Unlink"

## Important Notes

1. **Email Matching**: For account linking to work automatically, the Google account email must match the email/password account email. If emails don't match, Supabase will create a separate account.

2. **Multiple Identities**: Supabase supports multiple authentication identities per user. A user can have both email/password and Google OAuth linked to the same account.

3. **Profile Creation**: The database trigger automatically creates a profile entry when a new user signs up via OAuth. The profile is linked to `auth.users.id`.

4. **Session Management**: Supabase handles session management automatically. The session is stored in the browser and persists across page refreshes.

5. **Security**: Always use HTTPS in production. OAuth redirects will fail on HTTP in production environments.

## Troubleshooting

### "Redirect URI mismatch" Error

- Ensure your redirect URIs in Google Cloud Console match exactly with:
  - Supabase redirect URL: `https://your-project.supabase.co/auth/v1/callback`
  - Your app callback URL: `https://your-domain.com/auth/callback`

### "OAuth callback failed" Error

- Check that Google OAuth is enabled in Supabase Dashboard
- Verify Client ID and Client Secret are correct
- Ensure redirect URLs are configured correctly in both Google Cloud Console and Supabase

### Account Not Linking

- Verify that the Google account email matches the email/password account email
- Check browser console for any error messages
- Ensure user is signed in before attempting to link accounts

### Profile Not Created

- Check that the database trigger `handle_new_user()` is active
- Verify RLS policies allow profile creation
- Check Supabase logs for any errors

## Next Steps

After configuring Google OAuth in Supabase:

1. Test the sign-in flow locally
2. Test account linking in Settings
3. Deploy to production and update redirect URLs
4. Test the complete flow in production environment

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs/guides/auth/social-login/auth-google
- Check Google OAuth documentation: https://developers.google.com/identity/protocols/oauth2
