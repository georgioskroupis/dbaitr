#!/usr/bin/env bash
set -euo pipefail

# trigger-ci.sh — Create and push an empty commit to trigger CI/CD
#
# Usage:
#   bash scripts/ops/trigger-ci.sh [-b branch] [-r remote] [-m message] [-f] [-n]
#
# Options:
#   -b, --branch   Target branch (default: current branch)
#   -r, --remote   Git remote name (default: origin)
#   -m, --message  Commit message (default: chore: ci trigger <UTC-ISO>)
#   -f, --force    Stash dirty/staged changes temporarily to ensure truly empty commit
#   -n, --no-push  Do not push; create empty commit locally only
#   -h, --help     Show help

remote="origin"
branch=""
message=""
force=false
no_push=false

ts_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }
usage() { sed -n '2,20p' "$0"; }

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--branch) branch=${2:-}; shift 2;;
    -r|--remote) remote=${2:-}; shift 2;;
    -m|--message) message=${2:-}; shift 2;;
    -f|--force) force=true; shift;;
    -n|--no-push) no_push=true; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown option: $1" >&2; usage; exit 1;;
  esac
done

# Sanity checks
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repository" >&2; exit 1; }

if [[ -z "$branch" ]]; then
  branch=$(git rev-parse --abbrev-ref HEAD)
fi

git remote get-url "$remote" >/dev/null 2>&1 || { echo "Remote '$remote' not found" >&2; exit 1; }

if [[ -z "$message" ]]; then
  message="chore: ci trigger $(ts_utc)"
fi

# Ensure commit author is set (repo-local)
if ! git config user.email >/dev/null 2>&1; then
  git config user.email "ci@example.com"
fi
if ! git config user.name >/dev/null 2>&1; then
  git config user.name "CI Trigger Bot"
fi

# Ensure we are on the intended branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "$branch" ]]; then
  git checkout "$branch"
fi

# Worktree cleanliness checks
dirty=false; staged=false
git diff --quiet || dirty=true
git diff --cached --quiet || staged=true

stashed=false
if $force; then
  if $dirty || $staged; then
    echo "Stashing working changes to ensure an empty commit..."
    git stash push -u -m "trigger-ci: stash $(ts_utc)" >/dev/null
    stashed=true
  fi
else
  if $dirty || $staged; then
    echo "Refusing to proceed: working tree has changes. Use --force to stash temporarily." >&2
    exit 1
  fi
fi

cleanup() {
  if $stashed; then
    echo "Restoring stashed changes..."
    # Pop the latest stash (assumes it was created by this script)
    git stash pop >/dev/null || true
  fi
}
trap cleanup EXIT

echo "Creating empty commit on '$branch'..."
git commit --allow-empty -m "$message"

if $no_push; then
  echo "--no-push set; skipping push. Commit created locally."
  exit 0
fi

echo "Pushing to '$remote' '$branch'..."
git push "$remote" "$branch"
echo "Done. CI/CD should be triggered by the new empty commit."

