Mission & Scope
- You are an engineering assistant for this repository (AI-enabled social network built on Next.js App Router + Firebase).
- Primary goals: keep code production-safe, follow repo guardrails, and deliver small, focused, correct changes.
- Operate within the existing architecture; do not introduce new infra unless required to meet acceptance criteria.

Architecture Invariants
- Next.js App Router with Server Components. Client components must not import server actions. For client → server, expose API routes and call via fetch.
- Firebase on Hosting with Frameworks integration (Functions Gen2 SSR backend). One guarded Firebase web init at `src/lib/firebase.ts` using env vars and `getApps().length ? getApp() : initializeApp(cfg)`.
- Firestore rules are claims-based; storage rules restrict PII (`id_documents/{uid}/**`). Prefer secure, minimal indexes, lean queries, and fan-out-friendly modeling (distributed counters where needed).
- Separate heavy/AI workloads to server (Cloud Run/Functions). Enforce moderation before generation and sanitize outputs. Avoid prompt injection; never echo secrets.
- DX: TypeScript strict defaults, ESLint/Prettier, `.env.example`, and logging through `src/lib/logger.ts` gated by `NEXT_PUBLIC_DEBUG`.

Security & Privacy Rules
- Never import `firebase-admin` or server-only modules in client bundles.
- Do not import server actions in client components. Use API routes for client calls.
- Sanitize inputs and outputs for AI features; do not log secrets or PII.
- Keep secrets out of source control. Parameterize via environment variables and CI secrets.

Do / Don’t
- Do: Use extensionless imports for `@/lib/utils` (TS only). Place JSX helpers in `@/lib/react-utils`.
- Do: Prefer GET API route `/api/search/suggest?q=...` for semantic suggestions; use the consolidated hook `useSemanticSuggestions`.
- Do: Keep Suspense fallbacks as components (e.g., `AuthLoadingFallback`).
- Don’t: Add client → server action imports. Don’t add new global state providers without need. Don’t weaken security rules.

Code Review Checklist
- Types: no `any` where types are obvious; shared types for suggestions (`{ title, score, matches: string[] }`).
- Boundaries: client files avoid server-only imports; no `firebase-admin` in client; server-only code in routes/actions.
- Firebase: single guarded init in `src/lib/firebase.ts`; rules and indexes updated if data paths changed.
- Performance: default routes to static/auto; only mark `dynamic = 'force-dynamic'` when necessary.
- Logging: use `logger` instead of `console.log`.
- DX: keep `.env.example` updated; ensure scripts (lint, typecheck, build) pass.

PR Acceptance Criteria
- Build passes: install → lint (or skip if not configured) → typecheck → (tests if present) → build.
- No client → server action imports; API routes used for client calls.
- Utils and hooks patterns respected (utils.ts TS-only, `useSemanticSuggestions` consolidated).
- Firebase rules/configs valid; docs updated if data paths changed.
- No plaintext secrets. Deploy workflows use secrets or WIF.

