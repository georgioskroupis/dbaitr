# Code Review and Completion Pass

This pass focused on utils refactor, semantic suggestions, API routing, Firebase config, logging, CI/CD, and auth UX.

## Summary of Fixes

- Utils consolidation:
  - Removed `src/lib/utils.tsx`; added `src/lib/react-utils.tsx` for JSX helpers.
  - Ensured `src/lib/utils.ts` is TS-only and all imports use `@/lib/utils` (extensionless).
- Semantic suggestions:
  - Added `src/hooks/useSemanticSuggestions.ts` exposing `{ suggestions, loading, query, debouncedFetchSuggestions, clear }`.
  - Updated `src/app/page.tsx`, `src/components/layout/TopNav.tsx`, `src/components/search/GlobalSearchModal.tsx` to use the hook.
  - Added GET API route `src/app/api/search/suggest/route.ts` returning `{ suggestions }`.
  - Hook now calls `fetch('/api/search/suggest?q=...')` and guards stale results + de-dupes by title.
  - Normalized suggestion type to `{ title, score, matches: string[] }`.
- Client/server boundaries:
  - Removed client imports of server actions; clients now use the API route.
- Auth loading fallback:
  - Extracted `src/components/auth/AuthLoadingFallback.tsx` and used it in `src/app/auth/layout.tsx`.
- Dynamic rendering:
  - Removed unnecessary `force-dynamic` from auth and topic pages to improve static performance.
- Firebase init & deployability:
  - Added `.firebaserc`, `firebase.json` (frameworks-aware), `firestore.indexes.json`, `storage.rules`.
  - Created `src/lib/firebase.ts` with a single guarded init using env vars; removed `src/lib/firebase/config.ts` and updated imports.
  - Added `.env.example` covering required keys.
  - Added `README-DEPLOY.md` with deployment instructions and required GitHub secrets.
- Logging & DX:
  - Added `src/lib/logger.ts` and replaced scattered console logs across client/server.
- CI/CD:
  - Added `.github/workflows/ci.yml` for typecheck, lint, and build.
  - Updated `.github/workflows/deploy.yml` deploying to Firebase Hosting; parameterized `projectId` via `${{ secrets.FIREBASE_PROJECT_ID }}`.
- UX: Landing video
  - Deferred background video loading, respected `prefers-reduced-motion`, and avoided blocking search input.

## Notes

- No test framework existed; did not add new dependencies. Hook logic is simple and integration-tested via typecheck/build.
- Secrets required for deploy are documented in `README-DEPLOY.md`.

## Verification

- `npm ci && npm run typecheck && npm run build` succeed locally.
- `/api/search/suggest?q=test` responds with `{ suggestions: [] }` without secrets.

