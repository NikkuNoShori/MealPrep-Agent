# Google OAuth Setup Guide

## Overview

This guide explains how to set up Google OAuth authentication with Stack Auth.

## Prerequisites

1. Stack Auth project configured
2. Google Cloud Console project
3. OAuth 2.0 credentials created

## Step 1: Configure Google OAuth in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Navigate to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `https://api.stack-auth.com/api/v1/oauth/google/callback`
     - `http://localhost:5173/auth/callback` (for development)
     - `https://yourdomain.com/auth/callback` (for production)
   - Save the Client ID and Client Secret

## Step 2: Configure Google OAuth in Stack Auth Dashboard

1. Go to your [Stack Auth Dashboard](https://app.stack-auth.com/)
2. Navigate to "OAuth Providers" or "Social Logins"
3. Click "Add Provider" or "Configure Google"
4. Enter your Google OAuth credentials:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
5. Save the configuration

## Step 3: Configure Redirect URLs in Stack Auth

1. In Stack Auth Dashboard, go to "Settings" > "Redirect URLs"
2. Add the following redirect URLs:
   - `http://localhost:5173/auth/callback` (for development)
   - `https://yourdomain.com/auth/callback` (for production)

## Step 4: Test Google OAuth

1. Start your development server
2. Navigate to the sign in or sign up page
3. Click "Continue with Google"
4. You should be redirected to Google's OAuth consent screen
5. After authorizing, you should be redirected back to `/auth/callback`
6. The callback page will handle the OAuth response and sign you in

## Troubleshooting

### "OAuth callback failed: No authorization code"

- **Cause**: The OAuth callback URL is not configured correctly
- **Solution**: 
  - Verify the redirect URL in Google Cloud Console matches your callback URL
  - Verify the redirect URL in Stack Auth Dashboard matches your callback URL
  - Check that the callback route is registered in your app (`/auth/callback`)

### "OAuth error: access_denied"

- **Cause**: User denied access or OAuth configuration is incorrect
- **Solution**:
  - Verify Google OAuth credentials in Stack Auth Dashboard
  - Check that the Google+ API is enabled in Google Cloud Console
  - Verify redirect URIs match exactly (including protocol and port)

### "OAuth successful but session not established"

- **Cause**: Stack Auth cookies are not being set correctly
- **Solution**:
  - Check that "Allow all localhost callbacks for development" is enabled in Stack Auth Dashboard
  - Verify CORS settings allow cookies
  - Check browser console for cookie-related errors

## Implementation Details

### Frontend

- **OAuth Initiation**: `src/services/authService.ts` → `signInWithGoogle()`
- **OAuth Callback**: `src/pages/OAuthCallback.tsx`
- **OAuth Buttons**: `src/components/auth/LoginForm.tsx` and `src/components/auth/SignupForm.tsx`

### Backend

- Stack Auth handles the OAuth flow server-side
- The callback route (`/auth/callback`) processes the OAuth response
- User profile is automatically created if it doesn't exist

## Security Notes

1. **Never expose your Client Secret** in frontend code
2. **Use HTTPS in production** for OAuth callbacks
3. **Validate redirect URLs** to prevent open redirect vulnerabilities
4. **Store OAuth credentials securely** in environment variables

## Next Steps

After setting up Google OAuth:

1. Test the OAuth flow end-to-end
2. Verify user profiles are created correctly
3. Test RLS policies with OAuth-authenticated users
4. Consider adding other OAuth providers (GitHub, Microsoft, etc.)

