# dbaitr mobile

React Native + Expo app for secure native verification and mobile-first UX.

## Implemented in Phase 2

- Native auth session wiring (`@react-native-firebase/auth`)
- Native App Check activation and token acquisition (`@react-native-firebase/app-check`)
- Protected API client that always sends:
  - `X-Firebase-AppCheck`
  - `Authorization: Bearer <idToken>` (unless explicitly anonymous)
- Email-first auth flow:
  - check email existence (`/api/auth/check-email`)
  - route to sign in or sign up
  - bootstrap user claims/profile via `/api/users/bootstrap`
- Verification screen connected to backend:
  - create challenge (`/api/idv/challenge`)
  - refresh result (`/api/idv/result`)

## Security notes

- The same backend protection model is used as web: `withAuth` + strict App Check + strict ID token.
- Mobile never writes privileged fields directly; verification authority remains server-side.

## Prerequisites

1. Add Firebase native config files (not committed):
   - `apps/mobile/google-services.json`
   - `apps/mobile/GoogleService-Info.plist`
2. Enable App Check providers in Firebase Console:
   - Android: Play Integrity
   - iOS: App Attest (or DeviceCheck fallback)
3. For local/dev testing, set `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN` and register the token in Firebase App Check Console.

## Environment

Create `apps/mobile/.env` from `.env.example`.

Required:
- `EXPO_PUBLIC_API_BASE_URL` (example: `https://dbaitr.com`)

Optional (dev):
- `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN`

## Run

```bash
cd apps/mobile
npm install
npm run start
```

Use a custom dev client (`expo-dev-client`) because native Firebase modules are used.
