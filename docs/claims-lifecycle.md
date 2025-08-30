Claims Lifecycle & Session Refresh

- Claims managed centrally via Admin SDK (src/lib/authz/claims.ts setClaims/forceRefreshClaims).
- After any change, write user_private/{uid}.claimsChangedAt to signal clients.
- AuthZProvider listens to that doc; on change, calls getIdToken(true) and updates context; also broadcasts over BroadcastChannel('authz').
- AppBootstrapper listens for broadcast and updates SSR guard cookies db8_idt/db8_appcheck.

Status transitions
- Grace → Verified: on KYC completion, set { status: 'Verified', kycVerified: true }.
- Any → Suspended: restrict posting; SSR guard redirects to /account-suspended; APIs return 423 for forbidden actions.
- Any → Banned: revoke refresh tokens; client should sign-out; only public pages accessible.
- Deleted: used during deletion workflow; deny writes; tombstone user data; then hard-delete account.
