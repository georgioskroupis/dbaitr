#!/usr/bin/env bash
set -euo pipefail

# trigger-ci.sh — Commit current changes (or make an empty commit) and push to trigger CI/CD
#
# Usage:
#   bash scripts/ops/trigger-ci.sh [-b branch] [-r remote] [-m message] [--empty] [-f] [-n]
#
# Options:
#   -b, --branch   Target branch (default: current branch)
#   -r, --remote   Git remote name (default: origin)
#   -m, --message  Commit message (default: chore: ci trigger <UTC-ISO>)
#   --empty        Do not commit changes; create an empty commit instead
#   -f, --force    When using --empty with local changes, stash temporarily
#   -n, --no-push  Do not push; create commit locally only
#   -h, --help     Show help

remote="origin"
branch=""
message=""
empty=false
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
    --empty) empty=true; shift;;
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

default_msg="chore: trigger CI $(ts_utc)"
[[ -z "$message" ]] && message="$default_msg"

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

if $empty; then
  # Optional stash workflow for empty commit while changes exist
  dirty=false; staged=false
  git diff --quiet || dirty=true
  git diff --cached --quiet || staged=true
  stashed=false
  if $dirty || $staged; then
    if $force; then
      echo "Stashing working changes to ensure an empty commit..."
      git stash push -u -m "trigger-ci: stash $(ts_utc)" >/dev/null
      stashed=true
    else
      echo "Refusing to create empty commit while changes exist. Use --force or omit --empty to commit changes." >&2
      exit 1
    fi
  fi
  cleanup() {
    if $stashed; then
      echo "Restoring stashed changes..."
      git stash pop >/dev/null || true
    fi
  }
  trap cleanup EXIT
  echo "Creating empty commit on '$branch'..."
  git commit --allow-empty -m "$message"
else
  echo "Staging and committing current changes on '$branch'..."
  git add -A
  if git diff --cached --quiet; then
    echo "No changes to commit; creating empty commit instead..."
    git commit --allow-empty -m "$message"
  else
    git commit -m "$message"
  fi
fi

if $no_push; then
  echo "--no-push set; skipping push. Commit created locally."
  exit 0
fi

echo "Pushing to '$remote' '$branch'..."
git push "$remote" "$branch"
echo "Done. CI/CD should be triggered by the new empty commit."
