Version: 2026.02
Last updated: 2026-02-15
Owner: Platform Engineering
Non-negotiables:
- Web never performs personhood verification directly once mobile handoff is enabled
- Personhood approval stays server-authoritative in API routes
- Mobile verification must pass App Check and ID token requirements
Acceptance: Mobile scaffold and shared contracts exist, CI validates foundation, and apphosting build remains green

# Mobile + Web Architecture (Phase Plan)

## Why this split

- Keep Next.js for public pages, admin tools, and existing production stability.
- Add React Native mobile app for secure, native verification and richer mobile UX.
- Keep verification decisions in backend APIs only.

## Codebase layout

- `src/**` (existing): web app and API routes
- `apps/mobile/**`: React Native app scaffold
- `packages/shared/**`: shared contracts (auth and IDV payload shapes)
- `services/idv/**`: self-hosted proof verifier service

## Trust boundaries

- Web client: can request challenge and view status only.
- Mobile client: completes native verification flow and submits proof artifacts.
- API routes: verify cryptographic payload, dedup identity, set claims.
- Firestore `_private/**`: stores challenge hashes and dedup hashes only.

## Target verification flow

1. Web or mobile user signs in.
2. If on web, user is handed off to mobile app via deep link/QR.
3. Mobile creates challenge (`POST /api/idv/challenge`) with App Check + ID token.
4. Mobile runs native verification and submits proof (`POST /api/idv/verify`).
5. Backend verifies via self-hosted verifier and updates claims.
6. Web/mobile poll status (`POST /api/idv/result`).

## Phase delivery checklist

- Phase 1 (this change):
  - mobile scaffold and shared package foundation
  - CI foundation guard
  - architecture docs for future implementation
- Phase 2 (implemented baseline):
  - Firebase auth + secure session bootstrap in mobile
  - mobile App Check wiring and protected API header injection
  - implemented in:
    - `apps/mobile/src/firebase/native.ts`
    - `apps/mobile/src/http/apiFetch.ts`
    - `apps/mobile/src/auth/AuthProvider.tsx`
    - `apps/mobile/app/auth.tsx`
- Phase 3:
  - web-to-mobile handoff tokens and deep link flow
- Phase 4:
  - native proof execution and full E2E verification

## Operational notes

- Production deployment remains web-first through current App Hosting pipeline.
- Mobile release cadence should be independent (App Store / Play Store).
- Shared contracts reduce drift between web and mobile API behavior.
