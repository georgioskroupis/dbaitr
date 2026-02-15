# dbaitr mobile (Phase 1 scaffold)

This app is the foundation for native verification and mobile-first UX.

## Scope in Phase 1

- React Native + Expo project skeleton
- Route structure for in-app verification flow
- Shared API contracts consumed from `packages/shared`
- API base URL wiring (`EXPO_PUBLIC_API_BASE_URL`)

## Not implemented yet

- Firebase Auth session binding
- Mobile App Check (App Attest / Play Integrity)
- Native personhood verifier execution
- Proof submission + dedup UX

## Local setup

```bash
cd apps/mobile
npm install
npm run start
```

Optional env vars:

```bash
EXPO_PUBLIC_API_BASE_URL=https://dbaitr.com
```

## Handoff model

Web users will be redirected to this app for personhood verification. Verification completion and claim updates stay server-authoritative in the existing backend.
