# Stack Auth Trusted Domains Configuration

## What Are Trusted Domains?

Trusted domains in Stack Auth specify which domains are allowed to make authentication requests. This is a security feature that prevents unauthorized domains from using your Stack Auth project.

## Required Domains

Based on your application setup:

### Development (Local)

Add this trusted domain in Stack Auth Dashboard:

1. **Localhost Domain**:
   ```
   http://localhost
   ```
   - **Important**: Stack Auth does NOT allow ports in trusted domains
   - Use `http://localhost` (without the port number)
   - This will work for all localhost ports (5173, 3000, etc.)
   - Required for Stack Auth to work in development

**Note**: Even though your app runs on `http://localhost:5173`, Stack Auth only needs `http://localhost` (without the port) in the trusted domains list.

### Production (When Deployed)

When you deploy your app, add your production domain:

1. **Production Domain**:
   ```
   https://yourdomain.com
   ```
   - Replace `yourdomain.com` with your actual production domain
   - Must use `https://` (not `http://`) for production

2. **Production with www** (if you use www):
   ```
   https://www.yourdomain.com
   ```

## How to Configure in Stack Auth Dashboard

1. **Go to Stack Auth Dashboard**: https://app.stack-auth.com
2. **Navigate to your project** → **Settings** → **Trusted Domains** (or **Domain & Handlers**)
3. **Add each domain**:
   - Click "Add Domain" or "+"
   - Enter the domain (e.g., `http://localhost` - **without port**)
   - Save the changes

## Important Notes

- **NO PORT NUMBERS** - Stack Auth does NOT allow ports in trusted domains
  - Use `http://localhost` (not `http://localhost:5173`)
  - This will work for all localhost ports automatically
- **Use `http://` for local development** (localhost)
- **Use `https://` for production** (required for security)
- **Add both with and without `www`** if your production site uses www subdomain
- **Don't add trailing slashes** (e.g., `http://localhost/` is wrong, use `http://localhost`)

## Common Issues

### "Domain not trusted" Error

If you see this error:
1. Check that `http://localhost` (without port) is added to trusted domains
2. Make sure you're using `http://` for localhost, not `https://`
3. Verify there are no trailing slashes in the trusted domain
4. **Do NOT include port numbers** - Stack Auth will reject domains with ports

### CORS Errors

If you see CORS errors:
1. Ensure `http://localhost` (without port) is added to trusted domains
2. Stack Auth will accept requests from any localhost port when `http://localhost` is configured
3. Verify Stack Auth is using the correct project ID and publishable key
4. Make sure you're not trying to add ports - Stack Auth doesn't support them

## Quick Setup Checklist

For development:
- [ ] Add `http://localhost` (without port) to trusted domains
- [ ] Verify Stack Auth is working in your local app
- [ ] Test sign up, sign in, and password reset

For production:
- [ ] Add your production domain (e.g., `https://yourdomain.com`)
- [ ] Keep `http://localhost` for development (optional, or remove for security)
- [ ] Test authentication on production domain

