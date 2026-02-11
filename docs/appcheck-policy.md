App Check Policy

- Provider: reCAPTCHA v3 in production; debug token in development.
- Enforcement: enable for Firestore, Functions/HTTP, and Storage in production (Firebase Console).
- API: All protected routes use withAuth() which calls verifyAppCheckStrict and rejects missing/invalid tokens with 401.
- Client: All custom fetches should include X-Firebase-AppCheck header; helper at src/lib/appcheck/header.ts.
- Dev: window.FIREBASE_APPCHECK_DEBUG_TOKEN is managed in src/lib/appCheckClient.ts and surfaced via a toast in AppBootstrapper.


Enforcement & Smoke Tests
- Enable enforcement for Firestore, Functions/HTTP, Storage in Firebase Console (production only).
- Smoke: call a protected API without X-Firebase-AppCheck (e.g., /api/admin/whoami) and expect 401. With header + valid ID token, expect 200.
- A helper script placeholder exists at scripts/checks/appcheck-smoke.mjs.


OAuth redirects (YouTube) caveat
- Third‑party OAuth redirect callbacks do not carry App Check. We compensate with PKCE (S256) + strong state nonce and a strict redirect allowlist.
- oauth/start: generate code_verifier, compute code_challenge, store verifier with state (short TTL), include challenge in auth URL.
- oauth/callback: verify state and TTL, retrieve code_verifier, exchange code using PKCE, verify redirect URI, and delete pending state. After success, bump claimsChangedAt to refresh client claims.
Version: 2025.09
Last updated: 2025-09-01
Owner: Platform Engineering
Non-negotiables:
- Enforce App Check for protected APIs and client SDK (Firestore/Storage)
- ReCAPTCHA v3 provider; no bypass in production
- Fixed debug token in dev via env; no auto-generate fallback
- Initialize App Check before any Firestore usage
- Allowed domains restricted per Firebase App Check Console
Acceptance: Policy aligns with current code and Console config

# App Check Policy

- Provider: ReCAPTCHA v3 (`ReCaptchaV3Provider`). `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is read consistently.
- Dev token: `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` (fixed UUID registered in Console). We set `self.FIREBASE_APPCHECK_DEBUG_TOKEN` before `initializeAppCheck`. No UUID/true fallback.
- Init order: `initAppCheckIfConfigured()` runs in the app shell before any feature initializes Firestore. Our `getDb()` singleton also calls `ensureAppCheck()` as a safety net.
- Enforcement: Protected API routes require App Check headers via `withAuth`. Client SDK calls (Firestore/Storage) include App Check automatically once initialized.
- Domains: Localhost and apphosting preview domains are allowed in Console. Production domains are restricted.
