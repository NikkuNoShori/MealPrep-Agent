# Platform Auth SME Knowledge Base

Navigation for `platform-auth-sme`. **Not** household sharing — see `household-sme-knowledge/`.

## Canonical docs

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | Auth flow overview |
| [GOOGLE_OAUTH_SETUP.md](../../docs/GOOGLE_OAUTH_SETUP.md) | OAuth provider setup |
| [DOMAIN_TEST_MATRIX.md](../../docs/prompts/DOMAIN_TEST_MATRIX.md) | `platform-auth` integrity routing |

## Key code paths

| Surface | Files |
|---------|-------|
| Auth state | `src/stores/authStore.ts` |
| Supabase client | `src/services/supabase.ts` (authService) |
| Route guard | `src/components/auth/ProtectedRoute.tsx` |
| Login/signup UI | `src/components/auth/LoginForm.tsx`, `SignUpForm.tsx` |
| OAuth return | `src/pages/AuthCallback.tsx` |
| Username setup | `src/pages/CompleteSetup.tsx` |
| Email verify | `src/pages/VerifyEmail.tsx` (resend TODO) |
| Settings | `src/pages/Settings.tsx` |
| Profile API | `api.ts` — `getMyProfile`, `updateUsername` |

## Session lifecycle

```
Sign in (email or OAuth)
  → supabase.auth session in localStorage (shimmed in tests)
  → authStore.initialize() via App.tsx
  → loadHousehold() + loadAppRole() (household-sme territory)
  → ProtectedRoute checks user + setup_completed
```

## Common failure modes

1. **Redirect loop signin ↔ app** — session null after OAuth; check AuthCallback token exchange and `oauth_redirecting` flag timing.
2. **Stuck on CompleteSetup** — `setup_completed` false on profile; username RPC failing.
3. **getUser() null in tests** — supabase-js short-circuits without session; mock `authService.getUser` or seed storage.
4. **Username taken** — error code `23505` mapped in `updateUsername`.
5. **Config drift** — local `supabase/config.toml` vs remote MFA/email OTP settings (MOP-0006 note).

## Tests

- `src/stores/__tests__/authStore.test.ts`
- `api.test.ts` — `getMyProfile`, `updateUsername` describes

## Handoff to household-sme

When the user is authenticated but household/invite/visibility is wrong → `household-sme`.
