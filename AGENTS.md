# Repository Guidelines

## Project Structure & Modules
- `src/`: Next.js (App Router) TypeScript app. Key areas: `src/app/**` (routes, API), `src/components/**` (UI in PascalCase), `src/lib/**` (utilities, Firebase, IDV helpers), `src/ai/**` (Genkit flows and dev entry).
- `services/`: Python microservices (`idv/`, `sentiment/`) with Dockerfiles and requirements.
- `scripts/`: Dev, seeding, checks, AI, and ops tooling.
- `public/`: Static assets. `docs/`: Ops and AI templates.

## Build, Test, and Dev Commands
- `npm run dev`: Start Next.js locally on port 9002.
- `npm run build` / `npm start`: Production build and serve.
- `npm run lint`: ESLint (extends `next/core-web-vitals`).
- `npm run typecheck`: Strict TypeScript check (no emit).
- `npm run dev:bootstrap`: Local bootstrap script (env, tools).
- `npm run dev:seed`: Seed Firestore from `scripts/seed/data/*`.
- `npm run check:boundaries`: Guard: no server actions in client files.
- AI/Genkit: `npm run genkit:dev` or `genkit:watch` for `src/ai/dev.ts`.

## Coding Style & Naming
- TypeScript, 2‑space indent; prefer explicit types on exports.
- React components: PascalCase (`src/components/FooBar.tsx`). Hooks: `useX` camelCase. Utilities and API route files: kebab/camel case (`find-similar-topics.ts`, `utils.ts`).
- Tailwind for styling; keep class lists tidy and colocate small styles.
- ESLint config in `.eslintrc.json`; console allowed. Run `lint` before committing.

## Testing Guidelines
- No unit test runner configured yet. Until added, use `npm run typecheck` and `npm run lint` as gates.
- If introducing tests, colocate as `*.test.ts(x)` next to source and document the runner in `package.json`.

## Commit & PR Guidelines
- Commit style: short imperative summary. Prefer prefixes like `feat:`, `fix:`, `chore:`, `build:`, `docs:`, `types:` (seen in history).
- PRs: include purpose, linked issues, and screenshots for UI. Note any schema or env changes; update `docs/` when applicable.
- CI: ensure `lint`, `typecheck`, and boundary checks pass; run `dev:seed` locally if data assumptions changed.

## Security & Configuration
- Copy `.env.example` → `.env.local`; never commit secrets. See `docs/ops/secrets.md` and `scripts/ops/apphosting-secrets.sh` for App Hosting secrets.
- Firebase rules live in `firestore.rules`/`storage.rules`. Review before data‑model changes.
