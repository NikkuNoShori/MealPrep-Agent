# Profile Creation Flow

## Overview

Profile creation happens in **two ways**:
1. **PRIMARY**: During user signup (`authService.signUp()` → `createProfile()`)
2. **FALLBACK**: Auto-created when fetching profile (`GET /api/profile` auto-creates if missing)

It is **NOT** done during login, but will be auto-created when user accesses their profile (e.g., Settings page).

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROFILE CREATION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

1. USER SIGNUP
   │
   ├─> SignupForm.tsx
   │   └─> authStore.signUp()
   │       │
   │       └─> authService.signUp()
   │           │
   │           ├─> Stack Auth: signUpWithCredential()
   │           │   └─> Creates user account in Stack Auth
   │           │
   │           ├─> Wait for session cookie
   │           │
   │           ├─> authService.getUser()
   │           │   └─> Verify user session established
   │           │
   │           └─> authService.createProfile() ✅ PROFILE CREATED HERE
   │               │
   │               └─> apiClient.createProfile()
   │                   │
   │                   └─> POST /api/profile
   │                       │
   │                       ├─> authenticateRequest middleware
   │                       │   └─> Verifies Stack Auth token from cookies
   │                       │
   │                       └─> Creates profile in database
   │                           └─> INSERT INTO profiles (stack_auth_id, email, first_name, last_name)
   │
   └─> ✅ User authenticated + Profile created

2. USER LOGIN
   │
   ├─> LoginForm.tsx
   │   └─> authStore.signIn()
   │       │
   │       └─> authService.signIn()
   │           │
   │           ├─> Stack Auth: signInWithCredential()
   │           │   └─> Authenticates existing user
   │           │
   │           ├─> Wait for session cookie
   │           │
   │           └─> authService.getUser()
   │               └─> Verify user session established
   │
   └─> ✅ User authenticated (NO profile creation)

3. GET PROFILE
   │
   ├─> Settings.tsx (or other component)
   │   └─> apiClient.getProfile()
   │       │
   │       └─> GET /api/profile
   │           │
   │           ├─> authenticateRequest middleware
   │           │   └─> Verifies Stack Auth token from cookies
   │           │
   │           └─> Query database for profile
   │               │
   │               ├─> Profile exists → Return profile data
   │               │
   │               └─> Profile NOT found → Return 404 ❌
   │                   └─> NO auto-creation
   │
   └─> ⚠️ If profile creation failed during signup, user will get 404 here
```

## Code Flow

### 1. Signup Flow (Profile Created)

```typescript
// src/services/authService.ts
async signUp(firstName, lastName, email, password) {
  // Step 1: Create user in Stack Auth
  const result = await stackClientApp.signUpWithCredential({ 
    email, 
    password,
    verification_callback_url: verificationCallbackUrl
  });
  
  // Step 2: Wait for session cookie
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Step 3: Verify user session
  const user = await this.getUser();
  
  // Step 4: Create profile in database ✅
  await this.createProfile(user.id, firstName, lastName, email);
  //     └─> Calls POST /api/profile
}

async createProfile(userId, firstName, lastName, email) {
  // Calls API client
  await apiClient.createProfile({
    userId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
  });
  // └─> POST /api/profile with authentication
}
```

### 2. Login Flow (NO Profile Creation)

```typescript
// src/services/authService.ts
async signIn(email, password) {
  // Step 1: Authenticate with Stack Auth
  const result = await stackClientApp.signInWithCredential({ email, password });
  
  // Step 2: Wait for session cookie
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Step 3: Verify user session
  const user = await this.getUser();
  
  // ❌ NO profile creation here
  return user;
}
```

### 3. Get Profile Flow (WITH Auto-Creation)

```typescript
// server.js - GET /api/profile
app.get('/api/profile', authenticateRequest, async (req, res) => {
  const user = req.user; // From authentication middleware
  
  // Query database for profile
  let result = await db.query(
    `SELECT stack_auth_id as id, email, first_name, last_name 
     FROM profiles 
     WHERE stack_auth_id = $1`,
    [user.id]
  );
  
  if (!result || result.rows.length === 0) {
    // ✅ Auto-create profile if it doesn't exist
    const userEmail = user.email || `${user.id}@unknown.local`;
    
    result = await db.query(
      `INSERT INTO profiles (stack_auth_id, email, first_name, last_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (stack_auth_id) DO UPDATE 
       SET updated_at = CURRENT_TIMESTAMP
       RETURNING stack_auth_id as id, email, first_name, last_name, created_at, updated_at`,
      [user.id, userEmail, 'User', '']
    );
  }
  
  // Return profile data
  res.json({ profile: result.rows[0] });
});
```

## Key Points

### ✅ Profile Creation
- **PRIMARY**: Happens during signup (`authService.signUp()` → `createProfile()`)
- **FALLBACK**: Auto-created when fetching profile (`GET /api/profile` auto-creates if missing)
- Uses `POST /api/profile` endpoint (signup) or auto-creation in `GET /api/profile` (fallback)
- Requires authentication (cookies must be set)

### ❌ Profile NOT Created
- **NOT** created during login (`signIn()` doesn't call `createProfile()`)
- **BUT** will be auto-created when user accesses Settings (which calls `GET /api/profile`)

### ⚠️ Potential Issues

1. **Profile Creation Failure During Signup**
   - If `createProfile()` fails during signup, user is still authenticated
   - User will get 404 when trying to access their profile
   - Profile can be manually created later via `POST /api/profile`

2. **Missing Profile After Login** ✅ **FIXED**
   - If user signed up but profile creation failed, they'll have no profile initially
   - `GET /api/profile` will **auto-create** profile with default values
   - User can update their name later in Settings

3. **Auto-Creation on Profile Fetch** ✅ **IMPLEMENTED**
   - `GET /api/profile` **auto-creates** missing profiles
   - Uses default values: `firstName: 'User'`, `lastName: ''`, `email: user.email`
   - User can update their name later in Settings

## Recommendations

### Option 1: Auto-Create Profile on First Fetch (Recommended)
Add auto-creation logic to `GET /api/profile`:

```javascript
// server.js - GET /api/profile
app.get('/api/profile', authenticateRequest, async (req, res) => {
  const user = req.user;
  
  let result = await db.query(/* ... */);
  
  if (!result || result.rows.length === 0) {
    // Auto-create profile with Stack Auth user data
    result = await db.query(
      `INSERT INTO profiles (stack_auth_id, email, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (stack_auth_id) DO NOTHING
       RETURNING *`,
      [user.id, user.email || '', 'User', ''] // Default values
    );
  }
  
  // Return profile
});
```

### Option 2: Create Profile on Login (If Missing)
Add profile check to `signIn()`:

```typescript
// src/services/authService.ts
async signIn(email, password) {
  // ... existing signIn logic ...
  
  const user = await this.getUser();
  
  // Check if profile exists, create if missing
  try {
    await apiClient.getProfile();
  } catch (error) {
    if (error.status === 404) {
      // Profile doesn't exist, create it
      await this.createProfile(user.id, 'User', '', user.email || email);
    }
  }
  
  return user;
}
```

### Option 3: Keep Current Behavior
- Document that profile creation only happens on signup
- Handle 404 errors gracefully in UI
- Provide manual profile creation option

## Current Implementation Status

- ✅ Profile creation on signup: **Implemented** (may fail silently due to auth cookie timing)
- ❌ Profile creation on login: **NOT implemented** (removed to avoid duplicate calls)
- ✅ Auto-creation on profile fetch: **IMPLEMENTED** (GET /api/profile auto-creates if missing)
- ✅ Error handling: **Implemented** (auto-creation with fallback values)

## How It Works Now

1. **Signup**: Profile created during signup (if cookies are set in time)
2. **Login**: No profile creation (avoids duplicate calls)
3. **Settings Access**: Profile auto-created when user accesses Settings (GET /api/profile)
4. **Result**: Profile always exists when user accesses their profile

