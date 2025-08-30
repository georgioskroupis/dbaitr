App Check Policy

- Provider: reCAPTCHA v3 in production; debug token in development.
- Enforcement: enable for Firestore, Functions/HTTP, and Storage in production (Firebase Console).
- API: All protected routes use withAuth() which calls verifyAppCheckStrict and rejects missing/invalid tokens with 401.
- Client: All custom fetches should include X-Firebase-AppCheck header; helper at src/lib/appcheck/header.ts.
- Dev: window.FIREBASE_APPCHECK_DEBUG_TOKEN is managed in src/lib/appCheckClient.ts and surfaced via a toast in AppBootstrapper.
