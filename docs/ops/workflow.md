# Deployment Workflow Rules

This repo follows a simple, consistent flow for local work and production deploys.

Rules
- Local branches: work on any number of local branches.
- Remote branches: only use `main` on the remote.
- Pushes: use the interactive script to optionally merge local work to `main` and push.
- Empty commit: if there is nothing to commit, an empty commit is created to trigger Firebase App Hosting.
- App Hosting: production uses the same App Hosting backend instance: Studio.

Command
- `bash scripts/ops/push-main.sh`
  - Shows current branch.
  - Ask: merge everything to local `main` OR just commit to the current branch.
  - If merge to local `main`, asks if you want to push to remote `main`.
  - Always creates an empty commit if nothing changed, so deployment triggers.
  - Attempts to verify the App Hosting backend named "Studio" (best-effort).

Notes
- If `origin/main` is protected and requires PRs, direct pushes will be rejected by GitHub. Adjust branch protection if you want script pushes to succeed.
- The script never pushes to any remote branch other than `main`.
- It sets default git author info if missing to ensure commits can be created.

