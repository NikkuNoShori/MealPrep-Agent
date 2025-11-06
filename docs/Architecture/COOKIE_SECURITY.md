# Cookie Security Configuration

## Stack Auth Cookie Security

Stack Auth handles cookie security settings automatically when using `tokenStore: "cookie"`. The cookies are configured with:

- **HttpOnly**: Prevents JavaScript access (XSS protection)
- **Secure**: Only sent over HTTPS in production
- **SameSite**: Prevents CSRF attacks (typically `Lax` or `Strict`)

## Current Configuration

The Stack Auth client is configured in `src/stack/client.ts`:

```typescript
stackClientApp = new StackClientApp({
  tokenStore: "cookie",  // Uses secure cookies
  projectId,
  publishableClientKey,
});
```

## Cookie Security Features

### Automatic Security
- Stack Auth automatically sets secure cookie flags
- Cookies are HttpOnly by default (cannot be accessed via JavaScript)
- Secure flag is set in production (HTTPS only)
- SameSite is configured to prevent CSRF

### Manual Verification
To verify cookie security settings:

1. **Check in Browser DevTools**:
   - Open DevTools → Application → Cookies
   - Verify cookies have:
     - `HttpOnly` flag ✓
     - `Secure` flag (in production) ✓
     - `SameSite` attribute ✓

2. **Check in Network Tab**:
   - Inspect Set-Cookie headers
   - Verify security flags are present

## Recommendations

### Production
- ✅ Stack Auth handles cookie security automatically
- ✅ Ensure HTTPS is enabled
- ✅ Verify cookies have HttpOnly and Secure flags

### Development
- ⚠️ Cookies may not have Secure flag (HTTP allowed)
- ✅ HttpOnly flag should still be present
- ✅ SameSite should be configured

## Additional Security

### Server-Side Cookie Settings
If you need to set additional cookies server-side, use secure settings:

```javascript
res.cookie('cookieName', 'value', {
  httpOnly: true,        // Prevent JavaScript access
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
  sameSite: 'strict',    // Prevent CSRF
  maxAge: 86400000,      // 24 hours
});
```

## Stack Auth Cookie Names

Stack Auth uses cookie names like:
- `sf-access-token` (default)
- `stack-auth-<projectId>`
- Other project-specific names

These are automatically configured with secure settings by Stack Auth.

