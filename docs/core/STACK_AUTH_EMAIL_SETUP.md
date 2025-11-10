# Stack Auth Email Configuration Guide

## Current Setup

Your Stack Auth is configured with:
- **Database**: Supabase PostgreSQL
- **Email Service**: Stack Auth default (`noreply@stackframe.co`)
- **Status**: Email service is configured and should be working

## Problem: Emails Not Sending

If Stack Auth is not sending emails (sign-up verification, password reset), check:
1. **Redirect URLs** - Must be configured in Stack Auth dashboard
2. **Email Settings** - Password reset emails must be enabled
3. **Spam Folder** - Emails from `noreply@stackframe.co` may go to spam

## Steps to Fix Email Sending

### 1. Verify Email Configuration (Already Configured)

Your Stack Auth is already using the default email service (`noreply@stackframe.co`). 

**If you want to use a custom email domain** (recommended for production):
     - **SMTP Host**: Your email provider's SMTP server (e.g., `smtp.gmail.com`, `smtp.sendgrid.net`)
     - **SMTP Port**: Usually `587` for TLS or `465` for SSL
     - **SMTP Username**: Your email address or SMTP username
     - **SMTP Password**: Your email password or app-specific password
     - **From Email**: The email address that will send emails (e.g., `noreply@yourdomain.com`)
     - **From Name**: Display name for emails (e.g., "Meal Prep Agent")

### 2. Popular Email Service Providers

#### Gmail SMTP
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP Username: your-email@gmail.com
SMTP Password: [Use App Password, not regular password]
```
**Note**: Gmail requires an "App Password" for SMTP. Generate one at: https://myaccount.google.com/apppasswords

#### SendGrid
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP Username: apikey
SMTP Password: [Your SendGrid API Key]
```

#### Mailgun
```
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP Username: [Your Mailgun SMTP username]
SMTP Password: [Your Mailgun SMTP password]
```

### 3. Enable Email Features

In Stack Auth Dashboard:
1. Go to **Authentication** → **Email Settings**
2. **Enable Email Verification** (if you want email verification on sign-up)
3. **Enable Password Reset Emails** (required for forgot password)
4. **Configure Email Templates**:
   - Password Reset Email Template
   - Email Verification Template (if enabled)

### 4. Set Redirect URLs (REQUIRED)

**This is critical!** Stack Auth needs to know where to redirect users after they click the password reset link.

1. Go to Stack Auth Dashboard → **Settings** → **URL Configuration**
2. **Add Redirect URLs**:
   - Password Reset: `http://localhost:5173/reset-password` (for development)
   - Password Reset: `https://yourdomain.com/reset-password` (for production)
   - Email Verification: `http://localhost:5173/verify-email` (if using email verification)

**Important**: If redirect URLs are not configured, password reset emails will fail or redirect to the wrong page.

### 5. Test Email Configuration

After configuring redirect URLs:
1. Try requesting a password reset
2. **Check your email inbox** (and **spam folder** - emails from `noreply@stackframe.co` often go to spam)
3. Check Stack Auth Dashboard → **Logs** for any email sending errors
4. Verify the reset link redirects to `/reset-password` on your app

**Note**: The code automatically includes the redirect URL (`redirectTo`) when sending password reset emails.

## Troubleshooting

### Emails Still Not Sending?

1. **Check Stack Auth Dashboard Logs**:
   - Go to your project → Logs
   - Look for email-related errors
   - Check for SMTP authentication failures

2. **Verify SMTP Credentials**:
   - Double-check SMTP host, port, username, password
   - Test SMTP connection using a tool like `telnet` or an email client

3. **Check Email Provider Limits**:
   - Some email providers have rate limits
   - Free Gmail accounts have daily sending limits
   - Consider using a dedicated email service (SendGrid, Mailgun) for production

4. **Check Spam Folder**:
   - Emails might be going to spam
   - Add `noreply@yourdomain.com` to your email contacts

5. **DNS/SPF Records** (for production):
   - Set up SPF, DKIM, and DMARC records for your domain
   - This helps prevent emails from being marked as spam

### Common Error Messages

- **"SMTP authentication failed"**: Check username/password in Stack Auth dashboard
- **"Connection timeout"**: Check SMTP host and port
- **"Email not sent"**: Check email service configuration in dashboard
- **"Rate limit exceeded"**: You've hit your email provider's sending limit

## Code Implementation

The code is already set up correctly. The `authService.ts` file uses:
- `sendPasswordResetEmail()` for password reset
- Stack Auth handles email verification automatically on sign-up (if enabled)

**You don't need to change any code** - just configure the email settings in the Stack Auth dashboard.

## Next Steps

1. ✅ Configure SMTP settings in Stack Auth dashboard
2. ✅ Enable password reset emails
3. ✅ Add redirect URLs
4. ✅ Test email sending
5. ✅ Check logs if emails still don't send

