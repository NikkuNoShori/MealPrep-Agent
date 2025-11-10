# RLS and Google OAuth Setup Summary

## ✅ Completed Tasks

### 1. Row Level Security (RLS) Setup

**Status**: ✅ Complete

**What was done**:
- Created `scripts/setup-rls-supabase.js` to set up RLS on all tables
- Enabled RLS on all 7 tables:
  - `profiles`
  - `recipes`
  - `chat_messages`
  - `family_members`
  - `meal_plans`
  - `receipts`
  - `user_preferences`

**RLS Policies Created**:
- **SELECT**: Users can view their own data (recipes also allow public viewing)
- **INSERT**: Users can only insert data with their own `user_id`
- **UPDATE**: Users can only update their own data
- **DELETE**: Users can only delete their own data

**Helper Functions**:
- `get_user_id_from_stack_auth_id(UUID)`: Converts `stack_auth_id` (UUID) to `user_id` (integer)
- `set_user_id(UUID)`: Sets the current user context for RLS using `stack_auth_id`

**How RLS Works**:
1. Before each database query, call `set_user_id(stack_auth_id)` to set the user context
2. RLS policies automatically filter queries based on `app.current_user_id` session variable
3. Users can only see/modify their own data (except public recipes)

**Next Steps for RLS**:
- Update `src/services/database.ts` to call `set_user_id()` before queries
- Test RLS policies with different user contexts
- Verify that public recipes are accessible to unauthenticated users

### 2. Google OAuth Setup

**Status**: ✅ Complete

**What was done**:
- Added `signInWithGoogle()` method to `src/services/authService.ts`
- Added Google OAuth buttons to `LoginForm.tsx` and `SignupForm.tsx`
- Created `OAuthCallback.tsx` page to handle OAuth callbacks
- Added `/auth/callback` route to `App.tsx`
- Created setup documentation in `docs/GOOGLE_OAUTH_SETUP.md`

**OAuth Flow**:
1. User clicks "Continue with Google" button
2. Redirects to Google OAuth consent screen
3. After authorization, redirects to `/auth/callback`
4. Callback page processes OAuth response
5. User is signed in and redirected to dashboard
6. Profile is automatically created if it doesn't exist

**Files Modified**:
- `src/services/authService.ts`: Added `signInWithGoogle()` method
- `src/components/auth/LoginForm.tsx`: Added Google OAuth button
- `src/components/auth/SignupForm.tsx`: Added Google OAuth button
- `src/pages/OAuthCallback.tsx`: New OAuth callback handler
- `src/App.tsx`: Added `/auth/callback` route

**Next Steps for OAuth**:
1. Configure Google OAuth in Google Cloud Console:
   - Create OAuth 2.0 credentials
   - Add redirect URIs: `http://localhost:5173/auth/callback` (dev) and production URL
2. Configure Google OAuth in Stack Auth Dashboard:
   - Add Google OAuth provider
   - Enter Client ID and Client Secret
   - Add redirect URLs
3. Test OAuth flow end-to-end

## 🔧 Configuration Required

### Stack Auth Dashboard

1. **Enable Google OAuth**:
   - Go to Stack Auth Dashboard → OAuth Providers
   - Add Google OAuth provider
   - Enter Google OAuth Client ID and Client Secret

2. **Add Redirect URLs**:
   - `http://localhost:5173/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

3. **Enable "Allow all localhost callbacks for development"** (if not already enabled)

### Google Cloud Console

1. **Create OAuth 2.0 Credentials**:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Create OAuth client ID (Web application)
   - Add authorized redirect URIs:
     - `https://api.stack-auth.com/api/v1/oauth/google/callback`
     - `http://localhost:5173/auth/callback` (development)
     - `https://yourdomain.com/auth/callback` (production)

2. **Enable Google+ API**:
   - Go to APIs & Services → Library
   - Search for "Google+ API"
   - Click "Enable"

## 📋 Testing Checklist

### RLS Testing

- [ ] Test that users can only see their own recipes
- [ ] Test that users can only modify their own recipes
- [ ] Test that public recipes are visible to unauthenticated users
- [ ] Test that users can only see their own chat messages
- [ ] Test that users can only see their own family members
- [ ] Test that users can only see their own meal plans
- [ ] Test that users can only see their own receipts
- [ ] Test that users can only see their own preferences

### OAuth Testing

- [ ] Test Google OAuth sign in flow
- [ ] Test Google OAuth sign up flow
- [ ] Verify user profile is created after OAuth
- [ ] Verify user can access protected routes after OAuth
- [ ] Test OAuth error handling
- [ ] Test OAuth callback with invalid code
- [ ] Test OAuth callback with error parameter

## 🚀 Next Steps

1. **Update Database Service**: Modify `src/services/database.ts` to call `set_user_id()` before queries
2. **Test RLS**: Verify that RLS policies work correctly with authenticated users
3. **Configure OAuth**: Set up Google OAuth in Stack Auth Dashboard and Google Cloud Console
4. **Test OAuth**: Test the complete OAuth flow end-to-end
5. **Documentation**: Update main README with RLS and OAuth information

## 📚 Documentation

- **RLS Setup**: `scripts/setup-rls-supabase.js` (includes inline documentation)
- **OAuth Setup**: `docs/GOOGLE_OAUTH_SETUP.md`
- **This Summary**: `docs/RLS_AND_OAUTH_SETUP.md`

