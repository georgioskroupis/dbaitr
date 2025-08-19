# Contributing

## Setup

1. Install Node 20.x
2. Clone the repo and install deps: `npm ci`
3. Copy `.env.example` to `.env.local` and fill required keys.

## Development

- Typecheck: `npm run typecheck`
- Lint (if configured): `npm run lint`
- Dev server: `npm run dev`

## Boundaries

- Client components must not import server actions or `firebase-admin`.
- Use API routes for client → server calls.
- Keep `src/lib/firebase.ts` as the single guarded init.
- Use `src/lib/logger.ts` for logging; enable debug via `NEXT_PUBLIC_DEBUG=1`.

Run the boundary check: `npm run check:boundaries`.

## AI Assistant

- System Prompt: `docs/ai/system-prompt.md`
- Run ad-hoc: `npm run ai -- "Your prompt here"`
- Templates:
  - Review: `npm run ai:review`
  - Refactor: `npm run ai:refactor`

Sessions persist under `.ai/sessions/<name>.json`. Reset with `--reset`.

## CI & Deploy

- CI runs install → typecheck → build (and lint if configured).
- Deploy workflow uses Firebase Hosting (frameworks). Secrets:
  - `FIREBASE_SERVICE_ACCOUNT`
  - `FIREBASE_PROJECT_ID`

