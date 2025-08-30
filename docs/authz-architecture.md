Unified Auth + App Check Architecture

- Single source of truth: custom claims { role, status, kycVerified }.
- Server-first enforcement: API wrapper verifies App Check then ID token; SSR/middleware performs presence redirect; clients are optimistic only.
- Client provides AuthZ context based on ID token result; listens to user_private/{uid}.claimsChangedAt to refresh and broadcast across tabs.
- Firestore Rules use claims exclusively; client writes to admin/analysis are denied.

Flows
- Login → set presence cookies db8_authp + db8_appcp (non-HTTPOnly) for SSR redirect only; these are opaque, non-sensitive markers to avoid flicker. API calls still use Authorization header and X-Firebase-AppCheck.
- Claim change → Admin sets claims and writes user_private/{uid}.claimsChangedAt → clients refresh tokens and cookies.

References
- src/lib/authz/*
- src/lib/http/withAuth.ts
- firestore.rules

Admin Gate Pattern
- Middleware uses presence cookies for SSR guard only.
- Admin pages render a minimal skeleton and call /api/admin/whoami on mount (via useAdminGate) before fetching or rendering privileged content.
- Non-admins are redirected away before any sensitive data is fetched.
