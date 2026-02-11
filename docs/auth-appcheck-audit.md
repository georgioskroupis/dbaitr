# Firebase Authentication + App Check Audit (dbaitr)

Historical — pre-redesign

Note: This document reflects the system state before the unified Auth + App Check redesign (2025.09). It is kept for historical reference. For the current design, see:
- docs/authz-architecture.md
- docs/appcheck-policy.md

This report audits how Authentication and App Check are implemented across dbaitr (Next.js App Router on Firebase App Hosting with Firestore, Auth, App Check). It documents current behavior, highlights inconsistencies, and proposes design requirements for a unified, reliable approach. All references include file paths for verification.

## Executive Summary

- Top issues
  - Inconsistent App Check verification across API routes. Many sensitive admin/mod endpoints do not verify App Check at all (e.g., `/api/admin/*`, `/api/analysis/recompute`). Risk: Bots/scripted abuse and bypass of client SDK protections.
  - Mixed authorization sources: some APIs check `customClaims.role`, others check Firestore `users/{uid}.isAdmin|isModerator`, and some do both. This drift increases risk of privilege mismatches and TOCTOU issues.
  - Token freshness is uneven. The app does not consistently force `getIdToken(true)` after role changes; a few places do, but many do not, leading to stale claims.
  - Client Firestore reads are relied upon for privileged data in a few admin UIs with fallbacks, which can flap under tight security rules or App Check enforcement.
  - No global middleware/guard; gating is scattered per page/component (client) and per API route (server). Redirect patterns differ page-to-page.
  - App Check is optional on the client: initialized only if `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is present; dev uses debug token. Several backend verifiers accept missing tokens in dev. Production enforcement status depends on Console settings (not encoded in code). Risk: drift between envs.

- Quick wins
  - Standardize an auth/appcheck utility for API routes: verify App Check, then ID token, then role, with consistent error codes; apply across all routes.
  - Pick a single source of truth for role authorization (claims preferred) and require a short token refresh after role changes (UI + API guidance).
  - Add a minimal middleware or shared layout guard for protected pages to avoid first-render flash and centralize redirect logic.
  - Adopt a single “App Check required” stance for sensitive write APIs in prod; keep dev bypass explicitly gated by `NODE_ENV`.

---

## Routes Matrix (Per Page)

Columns: path | component_type | rendering | public_or_protected | required_role | login_state_requirements | kyc_dependency | appcheck_requirement | data_sources | auth_check_location | redirect_behavior | error_handling | known_edge_cases

- `/` (Home) | server + client mix | SSR/RSC | public | n/a | Anonymous | none | none | None; static content | n/a | n/a | Toaster for generic errors where present | none
- `/dashboard` | client (`src/app/(app)/dashboard/page.tsx`) | CSR (fetch `/api/topics`) | public | n/a | Anonymous | none | none | REST `/api/topics`; Firestore in components | n/a | n/a | Toaster on topic fetch failure | Initial loading spinners; not gated
- `/topics/new` | client (`src/components/topics/NewTopicForm.tsx`) | CSR | protected (action) | viewer+ | Grace Period or Verified | Yes (grace allowed) | none | Client Firestore writes via API (`/api/topics`), AI flow | Client guard in component | Redirect to `/auth?returnTo=...` if not signed-in | Toasts; disabled button | Race: guard after render shows alert before redirect
- `/topics/[topicId]` | server page + client detail (`TopicDetailClient`) | Force-dynamic (`export const dynamic = 'force-dynamic'`) | public (view) | n/a | Anonymous | none | none | Server reads via Admin helpers (`src/lib/server/topics.ts`), client Firestore listeners | n/a | n/a | In-client toasts if analysis fails | None
- `/live` | client | CSR | public | n/a | Anonymous | none | none | Firestore reads | n/a | n/a | None | None
- `/live/new` | client | CSR | protected (capability) | supporter/admin | Verified | none | none | API `/api/live/create` | Client guard | Likely redirect/deny in UI | Toasts | Role check also on API
- `/live/[id]` | server + client | Hybrid | protected (host/mod actions) | host or admin | Verified | none | some (mods posts use App Check) | Multiple API routes (`/api/live/*`) | API checks | n/a | JSON errors surfaced | None
- `/auth` | client (`src/app/auth/page.tsx`) | CSR | public | n/a | Anonymous | none | soft (dev optional) | `/api/auth/check-email` (App Check preferred) and Firebase Auth | API route + client SDK | n/a | Toasts and debug | None
- `/verify-identity` | server | RSC | protected (utility page) | viewer+ | Grace Period or Verified | yes | none | IDV components + APIs (`/api/idv/*`) | API checks | Redirects via client where necessary | UI messaging | None
- `/account-suspended` | client | CSR | protected (status page) | n/a | Suspended | yes | none | AuthContext status | Client guard | Redirect to `/dashboard` or `/verify-identity` based on state | UI messaging | Timing-based re-route
- `/admin` | client | CSR | protected | admin | Verified | none | none | `/api/admin/whoami` | Client hook `useIsAdmin` with server double-check | Redirect to `/dashboard` | Spinner + message | First-render guard flap possible
- `/admin/users` | client | CSR | protected | admin | Verified | none | none | `/api/admin/users/*` | Client hook + API checks | Show “Admins only” | Toasts | Pagination calls unauth if token absent
- `/admin/moderation` | client | CSR | protected | admin or moderator | Verified | none | partial (mod actions API lacks App Check) | `/api/admin/reports`, `/api/moderation/action` | Client guard + API enforcement | Redirect on fail | Toasts | Client fallback reads attempt Firestore if API blocked
- `/admin/analysis` | client | CSR | protected | admin | Verified | none | none | APIs for recompute/override | Client guard + API | Redirect on fail | Toasts | None
- `/admin/appeals` | client | CSR | protected | admin | Verified | none | none | `/api/admin/appeals` | Client guard + API | Redirect on fail | Toasts | None
- `/manifesto`, `/pricing`, `/transparency`, `/profile` | server/client mix | Hybrid | public | n/a | Anonymous | none | none | Mostly static; some API | n/a | n/a | Standard | None
- `/idv/diagnostics` | server | RSC | public (dev) | n/a | Anonymous | none | none | IDV helpers | n/a | n/a | None | None

Note: Dynamic admin pages under `(app)/admin/*` follow the same guard pattern using `useIsAdmin` with a server confirmation (`/api/admin/whoami`).

Sources: `src/app/(app)/**/*.tsx`, `src/components/topics/*`, `src/components/live/*`.

---

## Custom Claims Inventory

Columns: claim_name | type | who_sets_it | when_set | where_read | how_enforced | propagation_strategy | mirrored_in_firestore? | risks

- role | string (enum: super-admin, admin, moderator, supporter, viewer, restricted) | Script `scripts/admin/set-role.mjs` | Manual role change | Client: `useIsAdmin` (`getIdTokenResult()`), APIs check `(decoded as any).role` | UI gating; API route checks; Firestore Rules use `request.auth.token.role` | Inconsistent refresh; some places call `getIdToken(true)`, others not | Partially (users/{uid}.role not consistently used) | Staleness if token not refreshed; divergence from Firestore fields
- isAdmin | boolean | Potentially via custom claim tool (not provided) | Manual | Some API routes check `(decoded as any).isAdmin` | API check fallback | No guaranteed refresh | Yes: `users/{uid}.isAdmin` | Drift: claim vs Firestore copy mismatch
- isModerator | boolean | Same as above | Manual | Some API routes check `(decoded as any).isModerator` | API check fallback | No guaranteed refresh | Yes: `users/{uid}.isModerator` | Drift risk
- isSuperAdmin | boolean | Same as above | Manual | Few API routes accept it | API elevated allow | No guaranteed refresh | No | Overbroad allow if set accidentally
- admin (boolean) | Legacy alias | Manual | Some endpoints accept `admin===true` | API allow | No guaranteed refresh | No | Ambiguous aliasing
- kycVerified | boolean | Firestore user doc updated after IDV | On KYC completion | Client via `AuthContext` profile; Rules under threads; APIs (`/api/statements/create`) read from Firestore | Rules + API gate posting | n/a (not a claim) | Yes: `users/{uid}.kycVerified` | None; but not a claim so Rules must read doc

Notes:
- Only the `role` string is set by the provided script. Other boolean claims appear as legacy/alternative checks and should be normalized or removed.
- Firestore Rules also depend on `users/{uid}.isAdmin|isModerator` fields; these must be kept in sync or deprecated.

References: `scripts/admin/set-role.mjs`, `src/hooks/use-is-admin.ts`, many API routes (grep for `role ===`, `isAdmin`, `isModerator`).

---

## User Roles Capability Matrix

Columns: capability | super-admin | admin | moderator | supporter | viewer | restricted

- Access admin pages | yes | yes | no | no | no | no
- Manage users (view/edit) | yes | yes | no | no | no | no
- Moderate content | yes | yes | yes | no | no | no
- Create live debates | yes | yes | no | yes | no | no
- Create topics | yes | yes | yes | yes | yes | no (blocked by status)
- Post statements/questions | yes | yes | yes | yes | yes | no (blocked by status)
- Recompute AI analysis/overview | yes | yes | maybe (if treated as moderator) | no | no | no
- Override analysis pills | yes | yes | maybe | no | no | no
- Suspend/ban users | yes | yes | no | no | no | n/a

Enforcement
- UI: `useIsAdmin`, userProfile flags, role-driven menus
- API: role checks vs claims and/or Firestore doc flags
- Rules: Firestore Rules read `request.auth.token.role` + user doc fields

Source of truth
- Currently mixed between `role` claim and Firestore user flags; recommend consolidating on `role` claim and deriving UI from it.

---

## Login Status Matrix

Statuses: Anonymous | Grace Period | Verified | Suspended | Banned | Deleted

- Anonymous
  - Allowed: browse public pages, dashboard, topic pages
  - Blocked: creating topics, posting, admin pages
  - Redirects: to `/auth` for gated actions
  - Errors: toasts for auth-required
  - App Check: optional client init

- Grace Period (signed up within 10 days; computed in `AuthContext` and Rules)
  - Allowed: posting threads (`threads.create`) and statements depending on topic policy
  - Blocked: depends on topic `postingPolicy.requireVerified` and KYC-required operations
  - Redirects: may be sent to `/verify-identity` by UI flows
  - App Check: expected for write APIs

- Verified
  - Allowed: full functionality within role limits
  - App Check: expected for write APIs

- Suspended (10+ days without KYC; computed in `AuthContext`, page `/account-suspended`)
  - Allowed: browse
  - Blocked: creating topics/posts
  - Redirects: `/account-suspended` → CTA to `/verify-identity`
  - Errors: UI toasts

- Banned, Deleted
  - Not fully implemented as statuses; API/pages do not explicitly enforce. Should be added in redesign.

References: `src/context/AuthContext.tsx`, `src/app/(app)/account-suspended/page.tsx`, Firestore Rules grace logic for `threads`.

---

## API Endpoints & Server Actions Inventory

Columns: path | purpose | auth_verification | appcheck_verification | role/claim checks | rate_limits | emulator/prod differences | security_risks

General patterns
- ID token verification: Admin SDK `verifyIdToken` used widely.
- App Check verification: Implemented on selected routes via `getAppCheckAdmin().verifyToken(...)` with dev bypass; many admin routes lack it.
- Role checks: Varied use of `role` string claim and boolean claims or Firestore flags.

Selected endpoints (complete list in CSV):
- `/api/auth/check-email` — Check if email exists
  - Auth: none; public
  - App Check: yes (dev optional) [src/app/api/auth/check-email/route.ts L4-L18]
  - Roles: n/a
  - Risks: Enumeration mitigated with client-side flow; ensure throttling

- `/api/statements/create` — Create statement
  - Auth: Bearer ID token
  - App Check: yes (dev optional) [route.ts L20-L31, L46]
  - Roles: KYC/Grace via Firestore user doc; no role required
  - Rate limits: IP + user (`postIpLimiter`, `postUserLimiter`)

- `/api/threads/create` — Create thread node
  - Auth: Bearer ID token
  - App Check: yes (dev optional)
  - Roles: KYC/Grace similar to posts (implicit)

- `/api/analysis/recompute` — Recompute pills
  - Auth: Bearer; checks `role` or boolean `isAdmin/isModerator`
  - App Check: no
  - Risks: Missing App Check; recommend adding

- `/api/analysis/overview/recompute` — Recompute discussion overview
  - Auth: Bearer; checks claims and Firestore doc; dev bypass currently allowed
  - App Check: yes (dev optional)
  - Risks: Consistency with pills recompute, prefer unified policy

- `/api/admin/*` (users, reports, appeals)
  - Auth: Bearer; `verifyIdToken`
  - App Check: generally no
  - Roles: admin enforced via claims; some use Firestore `isAdmin`
  - Risks: Add App Check on write/privileged endpoints

- `/api/moderation/action`
  - Auth: Bearer; Firestore user flags `isAdmin|isModerator`
  - App Check: no
  - Risks: Add App Check and prefer claims

See CSV for full enumeration (path, checks, risks).

---

## Initialization & Runtime Contexts

- Client Firebase SDK
  - File: `src/lib/firebase.ts` — Modular v9, singletons, client-only guard; sets `browserLocalPersistence` for Auth. Fails fast if accessed on server.
  - App Check client: `src/lib/appCheckClient.ts` — Optional init via `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`; dev debug token support (persisted in `localStorage`); `initAppCheckIfConfigured()` called in `src/components/AppBootstrapper.tsx`.
  - Token refresh: no global listener; individual components sometimes call `getIdToken(true)`.

- Server (Admin SDK)
  - File: `src/lib/firebaseAdmin.ts` — Lazy singleton; tries `FIREBASE_SERVICE_ACCOUNT` (JSON), then `.secrets/serviceAccount.json`, else ADC. Provides `getAuthAdmin`, `getDbAdmin`, `getAppCheckAdmin`.
  - Usage: Most server routes call these helpers.

- Providers & runtime
  - `src/context/AuthContext.tsx` — Tracks `user`, `userProfile` via Firestore listener; computes `kycVerified` and `isSuspended` based on `registeredAt` (+10 days). Fetch fallback via `/api/users/me` on permission-denied.
  - `src/context/QueryProvider.tsx` — React Query; devtools now loaded client-only.
  - `src/components/AppBootstrapper.tsx` — Initializes App Check and surfaces the debug token in dev.

- Emulators/env guards
  - No explicit emulator wiring in code; dev/prod behavior is driven by `NODE_ENV` (e.g., App Check opt-in and verify bypass in dev).

---

## Security Rules & Enforcement Map

- Firestore Rules: `firestore.rules`
  - Role helpers use `request.auth.token.role` (claim) and cross-check Firestore `users/{uid}.isAdmin|isModerator`.
  - Users: own document readable; admin can read others.
  - Topics: public read, limited owner update; admin/moderators can update but not analysis fields from client.
  - Statements: public read; create requires auth; update by owner or admin/mod; thread creation allowed if user `kycVerified` or within 10-day grace window (computed in rules).
  - Aggregations: write limited to admin/mod.
  - Live debates: supporters/admin create; admin can update/delete.
  - Private admin area `_private/**`: fully denied.

- Storage Rules: `storage.rules`
  - `public/**` readable by anyone; `id_documents/{userId}/**` only owner read/write; deny everything else.

- App Check enforcement (service level)
  - Not expressed in code; must be verified in Firebase Console per environment. Server routes perform App Check verification for selected endpoints; Firestore/Storage enforcement controlled by Console setting. Gap: documentation and code assume variability.

Gaps
- Multiple admin/mod APIs do not verify App Check tokens; consider adding.
- Role checks rely on both claims and Firestore, increasing divergence risk.
- Client falls back to Firestore reads for admin UIs; ensure Rules and App Check parity to avoid flapping.

---

## Sequence Diagrams (textual)

1) Signup → Grace → KYC Verified → Verified
- Client (/auth → signup): calls `createUserWithEmailAndPassword` → writes `users/{uid}` (kycVerified=false, registeredAt=serverTimestamp).
- Status: Grace period computed client-side (AuthContext) and in Rules (10 days from registeredAt).
- User goes to `/verify-identity` → IDV flow (components under `src/components/idv/*`) → on success, server marks `users/{uid}.kycVerified=true`.
- Client AuthContext listener updates; UI unlocks posting/creation; Rules allow writes unconditionally for verified.

2) Role elevation (moderator/admin)
- Admin sets claim via script (`scripts/admin/set-role.mjs`) → custom claim `role=admin|moderator`.
- User must refresh token: ideally `getIdToken(true)` called (currently inconsistent). Some flows call server `/api/admin/whoami` to double-check, but claim still needs refresh for Rules and APIs.
- UI gates update (`useIsAdmin`), admin pages/menus appear; APIs that check claims succeed.

3) Protected page load (admin)
- Client navigates to `/admin` → `useIsAdmin` checks token claims → if not admin, calls `/api/admin/whoami` for double-check → on fail redirects to `/dashboard`.
- No middleware; first-render may flash limited UI before redirect in slow networks.

4) Sensitive operation (create statement)
- Client prepares request with `Authorization: Bearer <ID token>` and App Check header (if initialized) via `lib/client/statements.ts`.
- Server (`/api/statements/create`) verifies App Check (dev optional), verifies ID token, checks KYC/grace via Firestore doc, applies rate limits, then writes.
- Errors are returned as JSON with specific codes (`kyc_required`, `rate_limited`, etc.).

---

## Anti-Patterns Checklist (Pass/Fail with references)

- Duplicate Firebase app initialization: Pass — singletons used (`src/lib/firebase.ts`, `src/lib/firebaseAdmin.ts`).
- Reading claims from Firestore copy instead of ID token: Fail — several APIs rely on Firestore `isAdmin|isModerator` (e.g., `/api/moderation/action`).
- Not forcing token refresh after claim changes: Fail — only some UI actions force `getIdToken(true)`.
- Storing tokens in localStorage: Pass — Firebase SDK default; no manual storage of ID tokens; App Check debug token stored in `localStorage` (dev only) [intended by Firebase].
- Missing App Check verification in server routes: Fail — many admin routes lack App Check.
- Relying only on UI checks without Rules/API checks: Partial — many routes do server checks; admin/pages rely on UI + API double-check; no middleware.
- Mixing Admin SDK in client code paths: Pass — guarded by server-only wrappers; client `lib/firebase.ts` throws on server access.
- Hydration/race conditions (guards after render): Partial Fail — admin pages and topic/new show after-render guards with possible flash.
- Inconsistent redirect logic across pages: Partial Fail — each page handles redirects independently.
- Emulator/prod drift (debug App Check tokens in prod): Pass-ish — debug token enabled only in dev, but enforcement parity should be confirmed.

References: See API files under `src/app/api/**`, providers/components mentioned above.

---

## Gap Analysis → Design Requirements for Unified Approach

- Unify authorization source of truth on `role` claim; remove boolean claim aliases and Firestore role flags from enforcement paths (retain for display/analytics only). Provide one admin script/Cloud Function to set and audit roles.
- Introduce a shared API guard util: App Check verify (strict in prod), ID token verify, role check, structured error codes; apply to all write and admin routes.
- Enforce App Check in production for all sensitive APIs. Keep dev bypass behind `NODE_ENV !== 'production'` and explicit allowlist.
- Standardize token refresh after role/status changes: client helper to call `getIdToken(true)` and re-fetch `/api/admin/whoami` once; server to reject stale claims with guidance code.
- Add middleware or top-level layout guard for protected routes to avoid first-render flash and centralize redirects/messaging.
- Document and enforce KYC policy consistently across UI, APIs, and Rules; avoid dual logic. Prefer server-side enforcement + Rules.
- Observability: structured logs for auth/appcheck failures with correlation IDs; user-facing error messaging consistency.

---

## Migration Risks & Guardrails

- Claims migration: switching from mixed Firestore flags to claim-only may lock out admins/mods with stale tokens. Mitigate with forced token refresh and a temporary dual-read period.
- App Check tightening: enabling enforcement across all services may break older clients. Stage rollout with monitoring and dev/debug token guidance.
- Middleware introduction: ensure SSR/edge behavior is compatible with Firebase App Hosting and does not cause loops; add allowlist for public routes.
- Rate limits: centralize and test; ensure 429 handling is consistent in UI.
- Backward compatibility: maintain API error codes; add feature flags to toggle new enforcement.

---

Appendix: See CSVs under `/docs/audit_csv/` for machine-readable matrices.
