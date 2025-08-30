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
