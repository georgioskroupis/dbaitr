Version: 2025.09
Last updated: 2026-02-11
Owner: Platform Engineering
Non-negotiables:
- App Hosting build is gated by `npm run apphosting:build`
- Sequence: lint → rules tests → Next build
- No weakening of lint/rules gates (warnings acceptable; errors must be 0)
Acceptance: CI runs the same pipeline and passes

App Hosting Build Pipeline (Quality Gates)

Build command
- In Firebase Console → App Hosting → Build settings, set the build command to:
  npm run apphosting:build

GitHub workflow wiring
- `CI` workflow (`.github/workflows/ci.yml`):
  - Runs on pull requests, non-main pushes, and manual dispatch.
  - Executes: `npm ci`, `typecheck`, `apphosting:build`, boundary checks.
- `Deploy to Firebase Hosting` (`.github/workflows/deploy.yml`):
  - Runs on pushes to `main` and manual dispatch.
  - Executes the same quality gate before deploy.
  - Validates deploy secrets and Firebase API access before deploy.
  - Runs post-deploy health checks for `dbaitr.com` and App Hosting backend URL.
- Operator scripts:
  - `npm run ci:trigger -- --wait` dispatches CI directly (no empty commit needed).
  - `npm run ops:deploy:prod -- --target-ref main` dispatches deploy and verifies health.

What it runs
- Lint: next lint + App Check header checker (scripts/checks/missing-appcheck-header.mjs)
- Rules tests: scripts/tests/rules.test.mjs (in-process, no external emulator)
- Framework build: next build

Previews
- If you enable Preview Channels for PRs, use the same build command to gate preview deploys.

Failure handling
- If lint or rules tests fail, the build exits non‑zero and the deploy is skipped. Fix locally and push again.
- If deploy credential validation fails (permission denied / missing secrets), deploy exits before rollout.
- If post-deploy health checks fail, deploy is marked failed even if upload succeeded.

Required IAM for GitHub deploy service account
- `roles/firebase.admin`
- `roles/serviceusage.serviceUsageConsumer`
