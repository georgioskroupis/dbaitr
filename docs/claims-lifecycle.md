Version: 2025.09
Last updated: 2025-09-01
Owner: Platform Engineering
Non-negotiables:
- Claims are single source of truth for role/status/kycVerified
- Updates via Admin flows/IDV propagate with claimsChangedAt
- Clients refresh ID token on claims change signal
Acceptance: Matches current server flows and client refresh behavior

Claims Lifecycle & Session Refresh

- Claims managed centrally via Admin SDK (src/lib/authz/claims.ts setClaims/forceRefreshClaims).
- After any change, write user_private/{uid}.claimsChangedAt to signal clients.
- AuthZProvider listens to that doc; on change, calls getIdToken(true) and updates context; also broadcasts over BroadcastChannel('authz').
- AppBootstrapper listens for broadcast and updates SSR guard cookies db8_authp/db8_appcp.

Status transitions
- Grace → Verified: on KYC completion, set { status: 'Verified', kycVerified: true }.
- Any → Suspended: restrict posting; SSR guard redirects to /account-suspended; APIs return 423 for forbidden actions.
- Any → Banned: revoke refresh tokens; client should sign-out; only public pages accessible.
- Deleted: used during deletion workflow; deny writes; tombstone user data; then hard-delete account.
