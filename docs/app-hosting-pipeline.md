Version: 2025.09
Last updated: 2025-09-01
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

What it runs
- Lint: next lint + App Check header checker (scripts/checks/missing-appcheck-header.mjs)
- Rules tests: scripts/tests/rules.test.mjs (in-process, no external emulator)
- Framework build: next build

Previews
- If you enable Preview Channels for PRs, use the same build command to gate preview deploys.

Failure handling
- If lint or rules tests fail, the build exits non‑zero and the deploy is skipped. Fix locally and push again.
