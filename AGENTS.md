# AGENTS.md — Always-Follow Rules for This Repo

## Purpose

Codex runs as a surgical teammate for this Next.js App Router app on Firebase. This file encodes our
non-negotiables, defaults, and working conventions. Follow it in every session and PR. Link into /docs for
deeper details.  
⚠️ Codex must **not** modify this file unless explicitly instructed.

## Non-Negotiables (Follow in every PR)

- **withAuth**: All protected API routes must use withAuth (verifies App Check header + Firebase ID token;
  enforces role/capability/status; rate limits; optional idempotency).
- **App Check**: ReCAPTCHA v3 only. Dev uses fixed token via `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN`. Initialize App
  Check before any Firestore/Storage use.
- **Singletons**: Exactly one Firebase client init and one Admin init. Use `src/lib/firebase/{client,admin}.ts`.
- **Presence cookies**: Only `db8_authp` and `db8_appcp`. Opaque; never store tokens in cookies or localStorage.
- **Server-only writes**: Clients never write to `admin/**` or `analysis/**`. Use Admin SDK in API routes for
  privileged fields (e.g., youtube.*, status).
- **Claims-only rules**: Authorization decisions use custom claims (role, status, kycVerified, claimsChangedAt)
  and route policy. Do not reintroduce legacy flags.
- **Security posture**: Never bypass App Check, weaken rules, or add debug endpoints. Secrets stay in env/Secret
  Manager. No new providers/integrations without approval.
- **Pipeline**: The App Hosting gate is authoritative. `npm run apphosting:build` must pass
  (lint + rules tests → Next build) with **0 lint errors**; warnings are tolerated unless trivial to fix.

## Architecture Snapshot (Current)

- Next.js (App Router) with server API routes: `src/app/api/**/route.ts`
- **Auth/App Check**
  - Client App Check: `src/lib/appCheckClient.ts` and `ensureAppCheck()` in `src/lib/firebase/client.ts` set
    fixed dev token from env, then initialize ReCAPTCHA v3.
  - Server verification: `src/lib/http/withAuth.ts` → `verifyAppCheckStrict`, `verifyIdTokenStrict`, `assertRole`,
    `assertStatus`; structured logs include requestId.
- **Firebase singletons**
  - Client: `src/lib/firebase/client.ts` exports getAuth, getDb, getRtdb, ensures App Check before Firestore use.
  - Admin: `src/lib/firebase/admin.ts` exports getDbAdmin, getAuthAdmin, FieldValue.
- **Claims & guardrails**
  - Claims: `src/lib/authz/{types,claims}.ts` with role, status, kycVerified, claimsChangedAt.
  - Context/hooks: `src/lib/authz/context.tsx`, `src/hooks/use-admin-gate.ts`, `src/lib/authz/routePolicy.ts`.
  - Presence cookies and SSR guards: `src/components/AppBootstrapper.tsx`.
- **HTTP conventions**
  - Client calls use `src/lib/http/client.ts` (apiFetch) which always attaches App Check and a fresh ID token
    (unless allowAnonymous).
  - Error mapping uses stable app codes. See `/docs/error-catalog.md`.
- **Live debates (YouTube)**
  - Provider: `src/providers/video/youtube.ts` (server-only; googleapis).
  - Create: broadcast + stream + bind; writes server-only fields (youtube.*) to Firestore.
  - Ingest: `/api/live/[id]/ingest` returns cached ingest if present (fast-path) or fetches from YouTube with
    clear 4xx codes.
  - Transition: `/api/live/[id]/transition` maps YouTube errors to explicit 4xx; server logs include preflight
    state (bound stream, streamStatus).
  - Poller: `/api/live/poll` reconciles statuses.
- **Live chat**
  - Firestore: rooms/messages read-only on client; writes through API routes.
  - RTDB: presence/typing read-only on client; server updates presence.
- **Checks & tests**
  - Custom checks: `scripts/checks/*` (App Check header, duplicate inits, legacy flags, server actions in client).
  - Firestore rules: `firestore.rules`; rules tests: `scripts/tests/rules.test.mjs`.
- **Build**
  - App Hosting gate: `npm run apphosting:build` → lint → rules tests → Next build.

## Table of Contents / When You Need Details

- Auth/App Check: `/docs/authz-architecture.md`, `/docs/appcheck-policy.md`
- Pipeline: `/docs/app-hosting-pipeline.md`
- Error semantics: `/docs/error-catalog.md`
- Diagnostics: `/docs/diagnostics.md`
- Claims lifecycle: `/docs/claims-lifecycle.md`
- Live debates: `/docs/live-debates.md`
- Live chat: `/docs/live-chat.md`
- Admin processes: `/docs/admin/*`
- AI integrations & templates: `/docs/ai/`, `/docs/ai/templates/*`
- Ops scripts & runbooks: `/docs/ops/*`
- Historical: `/docs/auth-appcheck-audit.md`
- Index: `/docs/README.md`

## Do / Don’t

- **Do**
  - Wrap protected API routes with withAuth and return stable app codes (never raw provider errors).
  - Use `getDb()` (client) and `getDbAdmin()` (server) only. Ensure App Check is initialized before client Firestore.
  - Keep server-only writes in server routes; reflect state to Firestore minimally (e.g., status, youtube.*).
  - Add structured logs with requestId for failures and important decisions (sanitized).
  - Update docs when changing behavior, error codes, or flows.
- **Don’t**
  - Don’t store or expose tokens in cookies/localStorage or logs.
  - Don’t import Firebase client SDK into API routes (server). Don’t init Firebase more than once.
  - Don’t bypass App Check or withAuth even “temporarily”. Don’t relax rules to “make tests pass”.
  - Don’t add new providers/integrations without explicit approval.
  - Don’t reintroduce legacy role flags or client writes to `admin/**` or `analysis/**`.

## Defaults

- **Error codes**  
  - Platform: 401 unauthenticated (includes unauthenticated_appcheck), 403 forbidden, 423 locked, 429
    rate_limited, 440 login_timeout, 500 server_error.  
  - YouTube integration:  
    - Create → 409 youtube_not_connected | 409 live_streaming_not_enabled  
    - Ingest → 400 no_stream | 404 stream_not_found | 409 youtube_not_connected | 409 no_ingestion_info  
    - Transition → 400 invalid_transition | 409 stream_not_bound | 409 stream_inactive | 409 youtube_not_connected | 409 live_streaming_not_enabled  
  - All app codes must come from `/docs/error-catalog.md` (don’t invent new codes).
- **Rate limiting (withAuth defaults)**  
  - Protected: 30 requests/minute per user; 120 requests/minute per IP  
  - Public: 120 requests/minute per IP  
  - Override per-route as needed.
- **Idempotency**  
  - Supported via withAuth({ idempotent: true }) + X-Idempotency-Key; snapshots persisted in
    `admin_operations`.
- **Logging**  
  - Structured JSON logs on server include: level, route, requestId, error/appCode, latency_ms; sanitize
    provider payloads.
- **App Check**  
  - reCAPTCHA v3; dev token fixed by `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN`; App Check must be initialized before
    any Firestore call; client requests include `X-Firebase-AppCheck`.

## PR Checklist

- **Correctness & security**
  - [ ] All new/modified protected API routes are wrapped by withAuth and return stable app codes.
  - [ ] Client calls use apiFetch (App Check + ID token); no fetches bypassing it.
  - [ ] No tokens in cookies/localStorage or logs; presence cookies unchanged.
  - [ ] No client writes to `admin/**` or `analysis/**`; privileged writes use Admin SDK in API routes.
  - [ ] Firebase singletons only; no duplicate inits; no client SDK in server routes.
  - [ ] App Check is initialized before any client Firestore usage (via AppBootstrapper/ensureAppCheck).
- **Observability & docs**
  - [ ] Structured logs added/kept for critical paths (include requestId; sanitize).
  - [ ] Relevant docs updated if behavior/error codes changed.
- **Build gates**
  - [ ] `npm run lint` has 0 errors (warnings OK unless trivial to fix).
  - [ ] `npm run test:rules` runs or is acceptably skipped; no rule relaxations.
  - [ ] `npm run apphosting:build` passes (lint → rules tests → build).

## Out of Scope

- Adding/changing providers (video, payments, etc.) without approval.
- Weakening security rules, App Check requirements, or withAuth verification.
- Introducing debug endpoints or exposing tokens/secrets.
- Modifying Firestore Rules to “make tests pass” unless it corrects a clear bug aligned with docs.

## Contact / Ownership

- Owner: Platform Engineering
- See `/docs/README.md` for the full documentation index and team-owned areas (admin, ai, ops).
- For auth/App Check questions: start with `/docs/authz-architecture.md` and `/docs/appcheck-policy.md`; escalate
  to the Platform team if behavior and docs diverge.


Acceptance
	•	/AGENTS.md is present at repo root.
	•	File content matches exactly the reviewed final version.
	•	`npm run apphosting:build` still passes.

