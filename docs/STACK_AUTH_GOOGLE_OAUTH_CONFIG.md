# Stack Auth Google OAuth Configuration Guide

## Your Google OAuth Credentials

**Client ID**: `72754375853-0lruj2dk166qhj5nf708rhgpf1kdhb40.apps.googleusercontent.com`  
**Client Secret**: `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`  
**Project ID**: `meal-prep-agent`

## Step-by-Step Configuration

### Step 1: Configure Google OAuth in Stack Auth Dashboard

1. **Go to Stack Auth Dashboard**:
   - Visit https://app.stack-auth.com/
   - Log in to your account
   - Select your project

2. **Navigate to OAuth Providers**:
   - Go to **Settings** → **OAuth Providers** (or **Social Logins**)
   - Look for **Google** in the list of providers
   - Click **Configure** or **Add Provider** if Google isn't listed

3. **Enter Google OAuth Credentials**:
   - **Provider**: Google
   - **Client ID**: `72754375853-0lruj2dk166qhj5nf708rhgpf1kdhb40.apps.googleusercontent.com`
   - **Client Secret**: `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`
   - **Enabled**: ✅ (check this box)

4. **Save Configuration**:
   - Click **Save** or **Update**

### Step 2: Configure Redirect URLs in Stack Auth

1. **Go to Redirect URLs Settings**:
   - In Stack Auth Dashboard, go to **Settings** → **Redirect URLs**
   - Or look for **Callback URLs** or **Allowed Redirects**

2. **Add Redirect URLs**:
   Add the following URLs (one per line or as separate entries):
   ```
   http://localhost:5173/auth/callback
   https://yourdomain.com/auth/callback
   ```
   
   **Important**: Replace `yourdomain.com` with your actual production domain when you deploy.

3. **Enable Localhost for Development**:
   - Look for **"Allow all localhost callbacks for development"** option
   - ✅ Enable this checkbox (recommended for development)

4. **Save Redirect URLs**:
   - Click **Save** or **Update**

### Step 3: Verify Google Cloud Console Redirect URIs

1. **Go to Google Cloud Console**:
   - Visit https://console.cloud.google.com/
   - Select project: **meal-prep-agent**
   - Navigate to **APIs & Services** → **Credentials**

2. **Edit OAuth 2.0 Client**:
   - Find your OAuth 2.0 Client ID: `72754375853-0lruj2dk166qhj5nf708rhgpf1kdhb40.apps.googleusercontent.com`
   - Click on it to edit

3. **Add Authorized Redirect URIs**:
   Add these URIs:
   ```
   https://api.stack-auth.com/api/v1/oauth/google/callback
   http://localhost:5173/auth/callback
   https://yourdomain.com/auth/callback
   ```
   
   **Note**: The first URI (`https://api.stack-auth.com/api/v1/oauth/google/callback`) is required for Stack Auth to handle the OAuth flow.

4. **Save Changes**:
   - Click **Save**

### Step 4: Test Google OAuth

1. **Start Your Development Server**:
   ```bash
   npm run dev
   ```

2. **Navigate to Sign In/Sign Up Page**:
   - Go to `http://localhost:5173/signin` or `http://localhost:5173/signup`
   - You should see a **"Continue with Google"** button

3. **Test OAuth Flow**:
   - Click **"Continue with Google"**
   - You should be redirected to Google's OAuth consent screen
   - After authorizing, you should be redirected back to `/auth/callback`
   - The callback page should show "Sign in successful! Redirecting..."
   - You should be redirected to the dashboard

## Troubleshooting

### "OAuth callback failed: No authorization code"
- **Cause**: Redirect URI mismatch
- **Solution**: 
  - Verify redirect URIs in Google Cloud Console match exactly
  - Verify redirect URIs in Stack Auth Dashboard match exactly
  - Check that `/auth/callback` route is registered in your app

### "OAuth error: access_denied"
- **Cause**: User denied access or OAuth not configured correctly
- **Solution**:
  - Verify Google OAuth credentials in Stack Auth Dashboard
  - Check that Google+ API is enabled in Google Cloud Console
  - Verify redirect URIs match exactly (including protocol and port)

### "OAuth successful but session not established"
- **Cause**: Stack Auth cookies not being set
- **Solution**:
  - Enable "Allow all localhost callbacks for development" in Stack Auth Dashboard
  - Check browser console for cookie-related errors
  - Verify CORS settings allow cookies

### Button doesn't appear or doesn't work
- **Cause**: Stack Auth not configured or OAuth not enabled
- **Solution**:
  - Verify `VITE_STACK_PROJECT_ID` and `VITE_STACK_PUBLISHABLE_CLIENT_KEY` are set in `.env`
  - Verify Google OAuth is enabled in Stack Auth Dashboard
  - Check browser console for errors

## Security Notes

⚠️ **Important**: 
- Never commit the `client_secret` to version control
- Store credentials securely in environment variables
- Use HTTPS in production
- Regularly rotate OAuth credentials

## Next Steps

After successful configuration:
1. ✅ Test OAuth flow end-to-end
2. ✅ Verify user profiles are created correctly
3. ✅ Test RLS policies with OAuth-authenticated users
4. ✅ Deploy to production and update redirect URIs

## Quick Reference

**Stack Auth Dashboard**: https://app.stack-auth.com/  
**Google Cloud Console**: https://console.cloud.google.com/  
**Your OAuth Client ID**: `72754375853-0lruj2dk166qhj5nf708rhgpf1kdhb40.apps.googleusercontent.com`

