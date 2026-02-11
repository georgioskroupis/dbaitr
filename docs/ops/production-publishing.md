Version: 2026.02
Last updated: 2026-02-11
Owner: Platform Engineering
Non-negotiables:
- Production deploys are only from `main` via `.github/workflows/deploy.yml`
- `main` is protected: PR flow required + required `Quality Gate` check
- No empty commits to trigger CI/CD
Acceptance: A maintainer can publish to production using one documented path and verify rollout from commands below

# Production Publishing Runbook

This is the single source of truth for publishing to production.

## What is enforced

As of 2026-02-11, branch protection on `main` enforces:

- Pull request flow on `main` (direct pushes blocked)
- Required status check: `Quality Gate`
- Strict checks (PR branch must be up to date before merge)
- Linear history required
- Conversation resolution required
- Force push disabled
- Branch deletion disabled
- Rules apply to admins

## Workflows

- CI workflow: `.github/workflows/ci.yml`
  - Triggers: pull requests, non-main pushes, manual dispatch
  - Gate: `npm ci`, `typecheck`, `apphosting:build`, `check:boundaries`
- Production deploy workflow: `.github/workflows/deploy.yml`
  - Triggers: `push` to `main`, manual dispatch
  - Gate + deploy + health checks

## Standard publish path (recommended)

1. Create/update your feature branch.

```bash
git checkout -b codex/<change-name>
```

2. Validate locally before pushing.

```bash
npm run -s apphosting:build
```

3. Push branch and open PR to `main`.

```bash
git push -u origin codex/<change-name>
gh pr create --base main --fill
```

4. Wait for `Quality Gate` to pass on the PR.

```bash
gh pr checks
```

5. Merge PR to `main`.

```bash
gh pr merge --squash --delete-branch
```

6. Production deploy starts automatically from the merge commit.

```bash
gh run list --workflow "Deploy to Firebase Hosting" --limit 5
gh run watch --exit-status
```

## Manual deploy path (no new merge)

Use this only when you intentionally want to redeploy an existing ref.

```bash
npm run ops:deploy:prod -- --target-ref main
```

The helper script dispatches the deploy workflow, waits for completion, and verifies health endpoints.

## Fast verification checklist

Run all commands and expect success/healthy responses.

```bash
# 1) Deploy workflow for latest production commit is successful
gh run list --workflow "Deploy to Firebase Hosting" --limit 1

# 2) Public health endpoint
curl -fsS https://dbaitr.com/api/health

# 3) App Hosting backend health endpoint
curl -fsS https://studio--db8app.us-central1.hosted.app/api/health
```

Expected health JSON:

```json
{"ok":true,"route":"health"}
```

## Helpful operator commands

```bash
# Trigger CI without creating a commit
npm run ci:trigger -- --wait

# Safe helper to push local main (fails if dirty/behind)
npm run ops:push:main

# Re-apply standardized branch protection to main
bash scripts/ops/enforce-main-protection.sh
```

## Common failures and fixes

- `Quality Gate` fails on PR:
  - Run `npm run -s apphosting:build` locally and fix lint/rules/build issues.
- Deploy fails at "Validate deploy secrets":
  - Ensure `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_PROJECT_ID` GitHub secrets exist.
- Deploy fails at "Verify Firebase API access for deploy credentials":
  - Ensure deploy service account has:
    - `roles/firebase.admin`
    - `roles/serviceusage.serviceUsageConsumer`
  - See `docs/ops/secrets.md` for IAM verification commands.
- Deploy succeeds but site unhealthy:
  - Inspect the failing run logs and App Hosting runtime logs before retrying.

## Do not do

- Do not rely on empty commits to trigger deploys.
- Do not bypass PR checks by weakening branch protection.
- Do not modify deploy workflow to skip `apphosting:build`.
