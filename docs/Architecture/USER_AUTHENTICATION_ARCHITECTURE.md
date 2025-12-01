# User Authentication Architecture

## Overview

This document clarifies the user authentication and data storage architecture, specifically addressing the relationship between Stack Auth and our `profiles` table.

## Architecture Summary

### ✅ What We Use

1. **Stack Auth (External Service)**
   - **Purpose**: Authentication and user account management
   - **Source of Truth**: Stack Auth is the **only** source of truth for user accounts
   - **Location**: External service (api.stack-auth.com)
   - **What it stores**: User credentials, email, password, session tokens
   - **Used for**: Signup, login, logout, password reset, email verification

2. **`profiles` Table (Public Schema)**
   - **Purpose**: Application-specific user data
   - **Location**: PostgreSQL database, `public` schema
   - **What it stores**: `first_name`, `last_name`, `email` (for display), application preferences
   - **Used for**: Storing user profile information that's specific to our application
   - **Relationship**: Created after successful Stack Auth signup via `POST /api/profile`

### Database

- **Location**: Supabase PostgreSQL database, `public` schema
- **Tables**: `profiles` table stores application-specific user data
- **RLS**: Row Level Security policies ensure users can only access their own data

## Signup Flow

```
1. User submits signup form
   ↓
2. Frontend calls authService.signUp()
   ↓
3. authService.signUp() calls Stack Auth API (signUpWithCredential)
   ↓
4. Stack Auth validates email uniqueness and creates account
   ↓
5. If successful, authService.createProfile() creates entry in profiles table
   ↓
6. User is logged in and redirected to dashboard
```

## Error Handling

### "A user with email 'X' already exists"

This error comes from **Stack Auth**, not from our `profiles` table.

- **Source**: Stack Auth API response
- **Reason**: Stack Auth maintains its own user database and checks for duplicate emails
- **Solution**: 
  - Delete the user from Stack Auth dashboard
  - Or sign in with existing credentials

## Code References

### Signup Implementation

```typescript
// src/services/authService.ts
async signUp(firstName: string, lastName: string, email: string, password: string) {
  // Calls Stack Auth API
  const result = await stackClientApp.signUpWithCredential({ 
    email, 
    password,
    verification_callback_url: verificationCallbackUrl
  });
  
  // After successful Stack Auth signup, create profile in our database
  await this.createProfile(user.id, firstName, lastName, email);
}
```

### Profile Creation

```typescript
// src/services/authService.ts
async createProfile(userId: string, firstName: string, lastName: string, email: string) {
  // Creates entry in profiles table (public schema)
  const response = await fetch('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ userId, firstName, lastName, email }),
  });
}
```

### Server-Side Profile Endpoint

```javascript
// server.js - POST /api/profile
app.post('/api/profile', authenticateRequest, async (req, res) => {
  // Inserts into profiles table (public schema)
  const result = await db.query(
    `INSERT INTO profiles (id, email, first_name, last_name, ...)
     VALUES ($1, $2, $3, $4, ...)
     ON CONFLICT (id) DO UPDATE ...`,
    [userId, email, firstName, lastName]
  );
});
```

## Database Schema

### `profiles` Table (Public Schema)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,              -- Stack Auth user ID
  email VARCHAR(255),               -- Display email (synced from Stack Auth)
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Row Level Security (RLS)

The `profiles` table has RLS policies enabled to ensure data security:

- **SELECT**: Users can only view their own profile
- **INSERT**: Users can only create their own profile
- **UPDATE**: Users can only update their own profile
- **DELETE**: Users can only delete their own profile

RLS is configured via `scripts/setup-rls-supabase.js` and uses the `set_user_id()` function to set user context before queries.

## Summary

- ✅ **Stack Auth**: Source of truth for authentication
- ✅ **`profiles` table**: Application-specific user data in Supabase
- ✅ **RLS Policies**: Database-level security for user data

**Key Point**: If you need to delete a user account, delete it from Stack Auth's dashboard. The profile in the database will be handled by RLS policies.

