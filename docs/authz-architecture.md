Unified Auth + App Check Architecture

- Single source of truth: custom claims { role, status, kycVerified }.
- Server-first enforcement: API wrapper verifies App Check then ID token; SSR/middleware performs presence redirect; clients are optimistic only.
- Client provides AuthZ context based on ID token result; listens to user_private/{uid}.claimsChangedAt to refresh and broadcast across tabs.
- Firestore Rules use claims exclusively; client writes to admin/analysis are denied.

Flows
- Login → set cookies db8_idt + db8_appcheck (non-HTTPOnly) for SSR redirect only. API still uses Authorization header and X-Firebase-AppCheck.
- Claim change → Admin sets claims and writes user_private/{uid}.claimsChangedAt → clients refresh tokens and cookies.

References
- src/lib/authz/*
- src/lib/http/withAuth.ts
- firestore.rules
