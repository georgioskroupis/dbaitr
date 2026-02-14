Version: 2026.02
Last updated: 2026-02-14
Owner: Platform Engineering
Non-negotiables:
- No ID image uploads in app flows
- No raw proof payload or raw nullifier persistence
- Dedup uses one-way HMAC hash only
- Claims (`kycVerified`) remain source of truth for posting gates
Acceptance: Routes/docs/tests reflect the proof-based flow and apphosting build passes

# Personhood Verification (Privacy-First)

## Goal

Verify that each account maps to one real human while minimizing retained data.

We intentionally store:
- Full name (public profile requirement)
- Verification state (`kycVerified` claim and mirrored user profile flag)
- Minimal metadata needed for dedup and auditability

We intentionally do **not** store:
- ID photos
- Selfies
- Raw proof payloads
- Raw provider nullifiers

## Current API Surface

- `POST /api/idv/challenge`
  - Auth: `withAuth` + App Check + ID token + `Grace|Verified`
  - Issues one-time challenge and stores only `challengeHash`
  - Optional verifier bootstrap URL is returned when configured

- `POST /api/idv/verify`
  - Auth: `withAuth` + App Check + ID token + `Grace|Verified`
  - Accepts JSON proof payload (no image uploads)
  - Verifies via configured provider endpoint
  - Deduplicates with `HMAC(nullifier)` in `_private/idv/nullifierHashes/{hash}`
  - On success, sets claims: `{ status: 'Verified', kycVerified: true }`

- `POST /api/idv/relay`
  - Public callback endpoint for Self relayers (no user auth)
  - Verifies relay payload via self-hosted verifier backend
  - Finalizes challenge + dedup + claims in the same server-only path

- `POST /api/idv/result`
  - Auth: `withAuth` + App Check + ID token + `Grace|Verified`
  - Read-only status mirror; never elevates privileges

## Provider Contract

Configure a verifier backend that validates Self/OpenPassport proofs and returns JSON:

```json
{
  "verified": true,
  "nullifier": "provider-nullifier-string",
  "assuranceLevel": "high",
  "attestationType": "passport"
}
```

Accepted aliases:
- `ok` instead of `verified`
- `nullifierHash` / `nullifier_hash` instead of `nullifier`

Failure shape example:

```json
{
  "verified": false,
  "reason": "invalid_proof"
}
```

## Self-Hosted Provider Topology

The recommended setup is a self-hosted verifier service (`services/idv`) on Cloud Run:
- `/start` generates Self deep links for a challenge
- `/verify` validates Self proof payloads using `@selfxyz/core`
- App route `/api/idv/relay` receives relayer callbacks and asks `/verify` to cryptographically verify
- App route `/api/idv/verify` remains as manual JSON-proof fallback

No third-party verifier receives authority over account status. Only app server routes can set claims.

## Storage Model

- `_private/idv/challenges/{challengeId}`
  - `uid`, `challengeHash`, `expiresAtMs`, `status`, `usedAt`
- `_private/idv/nullifierHashes/{dedupHash}`
  - `uid`, provider metadata, timestamps
- `users/{uid}`
  - `kycVerified`, `status`, `verifiedAt`, `personhood.{provider,dedupHash,...}`
- Firebase custom claims
  - `status=Verified`, `kycVerified=true`

## Environment Variables

Required in production:
- `IDV_SELF_VERIFY_URL`
- `IDV_DEDUP_HMAC_SECRET`

Optional:
- `IDV_SELF_START_URL` (returns verification deep link/session URL)
- `IDV_SELF_VERIFY_API_KEY`
- `IDV_CHALLENGE_TTL_MS` (default `600000`)
- `IDV_SELF_VERIFY_TIMEOUT_MS` (default `15000`)

Verifier service env (Cloud Run):
- `IDV_SHARED_API_KEY` (must match app `IDV_SELF_VERIFY_API_KEY`)
- `SELF_SCOPE_SEED`
- `PUBLIC_APP_URL`
- optional `SELF_ENDPOINT`, `SELF_ENDPOINT_TYPE`, `SELF_APP_NAME`, `SELF_APP_LOGO_URL`, `SELF_MOCK_PASSPORT`, `SELF_MINIMUM_AGE`, `SELF_EXCLUDED_COUNTRIES`, `SELF_OFAC`

Local dev only (never production):
- `IDV_DEV_FAKE_APPROVE=true`

## Manual Test Checklist

User flow:
1. Sign in and ensure full name is set in profile.
2. Open `/verify-identity` and generate a challenge.
3. Click `Open Verification App` and complete Self/OpenPassport verification.
4. Use `Check Verification Status` (or wait for auto refresh) until approved.
5. Confirm success banner and `POST /api/idv/result` shows `approved: true`.

Manual fallback:
1. Submit proof JSON via `/api/idv/verify`.
2. Expect the same approved outcome.

If UI shows `No start URL configured`:
1. Set `IDV_SELF_START_URL` in Secret Manager and map it in `apphosting.yaml`.
2. Ensure it points to an endpoint that returns JSON with `verificationUrl` (and optional `sessionId`).
3. Redeploy, then regenerate a challenge.

Dedup protection:
1. Verify account A with proof/nullifier.
2. Attempt account B with same nullifier.
3. Expect `409 duplicate_identity`.

Grace/suspension behavior:
1. User without verification can post only during grace window.
2. After grace expires, posting endpoints return `kyc_required` and UI routes user to verification.

Admin checks:
1. In admin users page, verified users show `Human Verified: true`.
2. Confirm no raw nullifier/proof appears in readable profile fields.

## Security Notes

- User-initiated verification endpoints remain App Check protected.
- `/api/idv/relay` is intentionally public for relayer callbacks; trust is based on cryptographic proof verification + one-time challenge checks + dedup transaction.
- `_private/**` remains client-inaccessible by Firestore rules.
- `scripts/checks/security-regression-guards.mjs` enforces proof-based invariants.
