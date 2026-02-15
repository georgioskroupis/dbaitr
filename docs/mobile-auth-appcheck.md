Version: 2026.02
Last updated: 2026-02-15
Owner: Platform Engineering
Non-negotiables:
- Mobile protected calls must include both App Check and ID token headers
- Verification authority remains server-only (`withAuth` routes)
- No privileged client-side writes
Acceptance: Mobile app has auth + App Check bootstrap and a reproducible setup checklist

# Mobile Auth + App Check Setup

## What this enables

- Mobile users can authenticate natively.
- Mobile calls to protected APIs satisfy backend requirements:
  - `X-Firebase-AppCheck`
  - `Authorization: Bearer <id token>`
- Mobile can bootstrap profile/claims and use IDV endpoints.

## Required Firebase setup

1. Create/register iOS and Android app entries in Firebase for this app.
2. Download native config files and place locally (do not commit):
   - `apps/mobile/google-services.json`
   - `apps/mobile/GoogleService-Info.plist`
3. Enable App Check providers:
   - Android: Play Integrity
   - iOS: App Attest (or DeviceCheck fallback)

## Dev setup

1. Register an App Check debug token in Firebase Console.
2. Set in `apps/mobile/.env`:
   - `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN=<token>`
3. Set API base URL:
   - `EXPO_PUBLIC_API_BASE_URL=https://dbaitr.com`

## Runtime path

- Auth flow:
  - `POST /api/auth/check-email` (anonymous + App Check)
  - Firebase auth sign-in/sign-up
  - `POST /api/users/bootstrap` (App Check + ID token)
- Verification flow:
  - `POST /api/idv/challenge`
  - `POST /api/idv/result`

## Troubleshooting

- `401 unauthenticated_appcheck`:
  - App Check not activated, provider misconfigured, or debug token missing/not registered.
- `401 unauthenticated`:
  - User not signed in or ID token missing/expired.
- `422 full_name_required` on bootstrap:
  - Registration must provide full legal name.

## Next phase

- Add web-to-mobile secure handoff tokens and deep-link session transfer.
- Integrate in-app proof execution path (native verifier) and proof submit endpoint usage.
