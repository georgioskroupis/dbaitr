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
Version: 2025.09
Last updated: 2025-09-01
Owner: Platform Engineering
Non-negotiables:
- withAuth enforces App Check + Firebase ID token on protected routes
- No tokens in cookies/localStorage; presence cookies only (db8_authp, db8_appcp)
- Claims-only Firestore Rules; server-only writes to admin/** and analysis/** via Admin SDK
- Singletons: one Firebase client init, one Admin init
- App Check initialized before any Firestore/Storage usage
Acceptance: Document matches current implementation; pipeline stays green

# Authorization & App Check Architecture

This document reflects the as-built state after the unified Auth + App Check redesign.

- Gateway: `withAuth(handler, opts)` verifies App Check (header `X-Firebase-AppCheck`) and Firebase ID token, applies capability/role/status gates, rate limits, and optional idempotency keys.
- ID token verification defaults to signature/issuer/audience/expiry validation (`verifyIdToken(token)`) for availability; strict revocation checks can be enabled with `AUTH_CHECK_REVOKED_STRICT=1`.
- Status gating supports a narrow fallback: when a route explicitly allows `Grace`, missing status claims are treated as `Grace` to avoid deadlocks during bootstrap/claim initialization.
- Claims: `role` (viewer|supporter|admin|super-admin), `status` (Grace|Verified|Suspended), `kycVerified` boolean (human/personhood verified), `graceUntilMs` timestamp, `claimsChangedAt` signal.
- User profile bootstrap: `/api/users/bootstrap` (server-owned) creates/repairs `users/{uid}`, requires a valid full name, and initializes missing default claims.
- Presence cookies: `db8_authp`, `db8_appcp` are opaque non-secret markers (rotated periodically) to help SSR guards; they never contain tokens.
- Route policy: capability-based affordances live in `routePolicy` and hooks (`useAdminGate`, `useIsAdmin`) and are backed by withAuth checks server-side.
- Admin writes: All writes to `admin/**` and `analysis/**` are done on the server via Admin SDK. Clients never write there.
- App Check: ReCAPTCHA v3 provider, fixed dev debug token from env, initialized before any Firestore usage to eliminate Listen failures.
