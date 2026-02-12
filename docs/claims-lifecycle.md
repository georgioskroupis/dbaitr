Version: 2025.09
Last updated: 2025-09-01
Owner: Platform Engineering
Non-negotiables:
- Claims are single source of truth for role/status/kycVerified
- Updates via Admin flows/personhood verification propagate with claimsChangedAt
- Clients refresh ID token on claims change signal
Acceptance: Matches current server flows and client refresh behavior

Claims Lifecycle & Session Refresh

- Claims managed centrally via Admin SDK (src/lib/authz/claims.ts setClaims/forceRefreshClaims).
- New-user defaults (`role=viewer`, `status=Grace`, `kycVerified=false`, `graceUntilMs`) are set server-side by `/api/users/bootstrap` when missing.
- After any change, write user_private/{uid}.claimsChangedAt to signal clients.
- AuthZProvider listens to that doc; on change, calls getIdToken(true) and updates context; also broadcasts over BroadcastChannel('authz').
- AppBootstrapper listens for broadcast and updates SSR guard cookies db8_authp/db8_appcp.

Status transitions
- Grace → Verified: on personhood verification completion, set { status: 'Verified', kycVerified: true }.
- Grace/Suspended/Verified → Verified: super-admin `kycOverride(true)` also sets `kycVerified=true` and reconciles status to `Verified` unless account is terminal.
- Grace/Verified → Grace|Suspended: super-admin `kycOverride(false)` sets `kycVerified=false` and reconciles status using `graceUntilMs`.
- Grace → Suspended: when `graceUntilMs` has passed and `kycVerified=false`, bootstrap/enforcement paths move status to `Suspended`.
- Any → Suspended: restrict posting; SSR guard redirects to /account-suspended; APIs return 423 for forbidden actions.
- Any → Banned: revoke refresh tokens; client should sign-out; only public pages accessible.
- Any → Deleted: `hardDelete` sets claims `{ status: 'Deleted', role: 'restricted', kycVerified: false }`, tombstones profile, revokes sessions, and deletes Auth user.
