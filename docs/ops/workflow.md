# Deployment Workflow Rules

This repo uses an explicit, workflow-dispatch friendly CI/CD model with no synthetic commits and no cross-workflow coupling.
Use `docs/ops/production-publishing.md` as the canonical operator runbook for publishing.

## Workflows

- `CI` (`.github/workflows/ci.yml`)
  - Triggers: pull requests, pushes to non-`main`, and manual dispatch.
  - Purpose: quality validation for development branches.
- `Deploy to Firebase Hosting` (`.github/workflows/deploy.yml`)
  - Triggers: pushes to `main` + manual `workflow_dispatch`.
  - Purpose: run production quality gate, deploy, and verify health.
- `Quality Lab` (`.github/workflows/qualitylab.yml`)
  - Triggers: pull requests only.
  - Purpose: PR-only advisory scan; not part of production rollout path.

## Quality Gate (both workflows)

- `npm ci --no-audit --no-fund`
- `npm run -s typecheck`
- `npm run -s apphosting:build`
- `npm run -s check:boundaries`

## Deploy Pipeline (main only)

1. Run quality gate.
2. Validate required secrets (`FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`).
3. Validate deploy credentials with Firebase API access (`hosting:sites:list`).
4. Deploy to Hosting `live` channel via `FirebaseExtended/action-hosting-deploy`.
5. Run post-deploy health checks:
   - `https://dbaitr.com/api/health`
   - `https://studio--db8app.us-central1.hosted.app/api/health`

## Recommended Commands

- Trigger CI on the current branch (no new commit needed):
  - `npm run ci:trigger -- --wait`
- Push already-reviewed `main` to production:
  - `npm run ops:push:main`
- Manual production deploy with run+health verification:
  - `npm run ops:deploy:prod -- --target-ref main`
- Inspect latest workflow runs:
  - `gh run list --workflow "CI" --limit 5`
  - `gh run list --workflow "Deploy to Firebase Hosting" --limit 5`
- Manual health verification:
  - `curl -fsS https://dbaitr.com/api/health`
  - `curl -fsS https://studio--db8app.us-central1.hosted.app/api/health`

## Notes

- Empty commits are no longer part of the deployment workflow.
- `scripts/ops/push-main.sh` is now a safe push helper only (no commit/merge automation).
- If branch protection requires PRs, direct pushes to `main` will be blocked by GitHub settings.
