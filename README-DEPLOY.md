# Deployment Guide

This project is a Next.js (App Router) app with Firebase (Auth, Firestore, Storage) and Genkit (Google AI).

## Environment Variables

Create a `.env.local` (or CI env) using `.env.example` as a template:

- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- GOOGLE_API_KEY or GEMINI_API_KEY (for Genkit Google AI)
- Optional: NEXT_PUBLIC_DEBUG=1 to enable client debug logging

### Identity Verification

Add the following for the privacy-first identity verification flow:

- NEXT_PUBLIC_IDV_ONDEVICE=true
- NEXT_PUBLIC_IDV_AI_APPROVAL=false
- NEXT_PUBLIC_IDV_STRICT_MINIMAL=true
- CLOUD_RUN_IDV_URL= (optional; set to your deployed IDV service URL for server fallback)

If `CLOUD_RUN_IDV_URL` is set, `/api/idv/verify` proxies multipart form-data to that service and returns only `{ approved, reason }`.

### On-device models and CSP

- Host Human models under `public/vendor/human/models/` and set `NEXT_PUBLIC_HUMAN_MODELS_URL=/vendor/human/models/`.
- Host Tesseract worker + wasm under `public/vendor/tesseract/` and set `NEXT_PUBLIC_TESSERACT_BASE_URL=/vendor/tesseract/`.
- Optional: enable hardened CSP headers by setting `NEXT_ENABLE_IDV_CSP=true`. Adjust if your app needs broader `connect-src`/`img-src`.

Placeholders are created for both folders; add actual model files during deploy.

## GitHub Secrets for Deploy

- FIREBASE_SERVICE_ACCOUNT: JSON for a Firebase service account with Hosting/Functions admin rights.
- FIREBASE_PROJECT_ID: your Firebase project id, e.g. `myapp-prod`.

The deploy workflow reads these values to deploy Hosting (and the Frameworks SSR backend) via `FirebaseExtended/action-hosting-deploy`.

## Firebase Config Files

- `.firebaserc` points to your default project.
- `firebase.json` is frameworks-aware; deploys Next.js SSR with Hosting + Functions v2 backend (`us-central1`).
- `firestore.rules` and `firestore.indexes.json` contain security rules and indexes.
- `storage.rules` secures uploads; only the authenticated owner can read/write to `id_documents/{uid}/...`.

If you need custom indexes, export with `firebase firestore:indexes` and commit to `firestore.indexes.json`.

## Local Dev

- Install: `npm ci`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Dev: `npm run dev`

## Using the AI Assistant

- System prompt lives in `docs/ai/system-prompt.md` and is auto-prepended by the AI runner.
- Run ad-hoc: `npm run ai -- "Your prompt here"`
- Run code review template: `npm run ai:review`
- Refactor template: `npm run ai:refactor`
- Sessions persist under `.ai/sessions/<name>.json`. Reset with `--reset`.
- Required env for real API calls: `OPENAI_API_KEY`. Without it, runs in dry-run mode.

## Deploy

- Push to `main` or trigger the `Deploy to Firebase Hosting` workflow manually.
- Ensure secrets are set in the GitHub repo settings as described above.

## Assumptions

- The app reads Firebase web config from environment variables (see `.env.example`).
- Semantic suggestions use `/api/search/suggest?q=...` backed by Firestore + Genkit flows.
- No `firebase-admin` code runs in the browser; all server-side only.

## Emulators (optional)

You can use the Firebase Emulators Suite for local development; not configured here by default. If needed, add `firebase.json` emulator entries and a `.env.local` pointing to emulator hosts.
