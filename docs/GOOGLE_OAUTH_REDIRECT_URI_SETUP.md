# Google OAuth Redirect URI Setup for Supabase

## Overview

This guide explains exactly what redirect URIs you need to configure in Google Cloud Console for Supabase OAuth to work.

## How Supabase OAuth Works

1. **User clicks "Sign in with Google"** → Frontend calls `supabase.auth.signInWithOAuth()`
2. **Redirects to Google** → User authorizes on Google
3. **Google redirects to Supabase** → `https://[project-ref].supabase.co/auth/v1/callback?code=...`
4. **Supabase processes code** → Supabase exchanges code for tokens
5. **Supabase redirects to frontend** → `http://localhost:5173/auth/callback#access_token=...&refresh_token=...`
6. **Frontend processes hash** → Supabase client automatically processes hash fragments

## Google Cloud Console Configuration

### Step 1: Get Your Supabase Project Reference

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **API**
4. Find your **Project URL**: `https://[project-ref].supabase.co`
5. Note the `[project-ref]` part (e.g., `abcdefghijklmnop`)

### Step 2: Configure Authorized Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:

```
https://[project-ref].supabase.co/auth/v1/callback
```

**Example:**
```
https://abcdefghijklmnop.supabase.co/auth/v1/callback
```

### Step 3: Configure Authorized JavaScript Origins (Optional but Recommended)

Under **Authorized JavaScript origins**, add:

```
https://[project-ref].supabase.co
```

**Example:**
```
https://abcdefghijklmnop.supabase.co
```

## Supabase Dashboard Configuration

### Step 1: Configure Site URL

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Set **Site URL**:
   - **Development**: `http://localhost:5173`
   - **Production**: `https://your-domain.com`

### Step 2: Configure Redirect URLs

Under **Redirect URLs**, add:

- **Development**: `http://localhost:5173/**`
- **Production**: `https://your-domain.com/**`

The `/**` wildcard allows any path under your domain to receive OAuth callbacks.

### Step 3: Enable Google Provider

1. Navigate to **Authentication** → **Providers**
2. Find **Google** and click **Enable**
3. Enter your **Client ID** and **Client Secret** from Google Cloud Console
4. Click **Save**

## Important Notes

### ⚠️ Redirect URI Format

**Correct:**
```
https://[project-ref].supabase.co/auth/v1/callback
```

**Incorrect:**
```
http://localhost:5173/auth/callback  ❌ (Don't use this in Google Console)
https://your-domain.com/auth/callback  ❌ (Don't use this in Google Console)
```

**Why?** Google redirects to Supabase first, then Supabase redirects to your frontend.

### ⚠️ Hash Fragments vs Query Parameters

Supabase OAuth uses **hash fragments** (`#access_token=...`) not query parameters (`?code=...`).

- **Google → Supabase**: Uses query parameters (`?code=...`)
- **Supabase → Frontend**: Uses hash fragments (`#access_token=...`)

The Supabase client automatically processes hash fragments when `detectSessionInUrl: true` is set (which is the default).

## Testing the Flow

### 1. Check Redirect URI in Google Console

Verify the redirect URI matches exactly:
```
https://[your-project-ref].supabase.co/auth/v1/callback
```

### 2. Check Site URL in Supabase

Verify Site URL is set to:
```
http://localhost:5173
```

### 3. Check Redirect URLs in Supabase

Verify Redirect URLs include:
```
http://localhost:5173/**
```

### 4. Test OAuth Flow

1. Click "Sign in with Google" in your app
2. You should be redirected to Google
3. After authorization, you should be redirected back to `/auth/callback`
4. The callback page should show "Sign in successful"

## Troubleshooting

### Issue: "redirect_uri_mismatch"

**Error**: `redirect_uri_mismatch: The redirect URI in the request does not match the ones authorized for the OAuth client.`

**Solution**:
1. Check Google Cloud Console **Authorized redirect URIs**
2. Must be exactly: `https://[project-ref].supabase.co/auth/v1/callback`
3. Check for typos, extra slashes, or missing `/auth/v1/callback` path
4. Make sure you're using `https://` not `http://`

### Issue: "No OAuth code in callback"

**Error**: `OAuth callback failed: No authorization code`

**Solution**:
- This is normal! Supabase OAuth uses hash fragments, not query parameters
- The OAuthCallback component has been updated to handle this correctly
- Make sure `detectSessionInUrl: true` is set in Supabase client config

### Issue: "OAuth successful but session not established"

**Error**: `OAuth successful but session not established`

**Solution**:
1. Check Supabase **Site URL** is set correctly
2. Check **Redirect URLs** include your callback path
3. Verify Google OAuth is enabled in Supabase Dashboard
4. Check browser console for errors
5. Try clearing browser cache and cookies

### Issue: "Invalid client"

**Error**: `invalid_client: The OAuth client was not found.`

**Solution**:
1. Verify **Client ID** and **Client Secret** in Supabase Dashboard
2. Make sure Google OAuth provider is enabled
3. Check that credentials are copied correctly (no extra spaces)

## Quick Checklist

- [ ] Google Cloud Console: Added `https://[project-ref].supabase.co/auth/v1/callback` to Authorized redirect URIs
- [ ] Supabase Dashboard: Set Site URL to `http://localhost:5173` (or production URL)
- [ ] Supabase Dashboard: Added `http://localhost:5173/**` to Redirect URLs
- [ ] Supabase Dashboard: Enabled Google provider with Client ID and Secret
- [ ] Frontend: OAuthCallback component handles hash fragments correctly
- [ ] Test: OAuth flow works end-to-end

## Example Configuration

### Google Cloud Console

**Authorized redirect URIs:**
```
https://abcdefghijklmnop.supabase.co/auth/v1/callback
```

**Authorized JavaScript origins:**
```
https://abcdefghijklmnop.supabase.co
```

### Supabase Dashboard

**Site URL:**
```
http://localhost:5173
```

**Redirect URLs:**
```
http://localhost:5173/**
```

**Google Provider:**
- Client ID: `[your-google-client-id].apps.googleusercontent.com`
- Client Secret: `[your-google-client-secret]`

## References

- [Supabase OAuth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth URL Configuration](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-jwts)

