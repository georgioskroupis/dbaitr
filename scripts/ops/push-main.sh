#!/usr/bin/env bash
set -euo pipefail

# push-main.sh — Safe helper to push local main to origin/main.
#
# Modernized behavior:
# - No auto-commit
# - No auto-merge between branches
# - No empty commits to trigger deploy
# - Fails fast on dirty working tree or behind main
#
# Usage:
#   bash scripts/ops/push-main.sh [--remote origin] [--force-with-lease] [--no-fetch]

remote="origin"
main_branch="main"
no_fetch=false
force_with_lease=false

usage() {
  cat <<USAGE
Usage: bash scripts/ops/push-main.sh [options]

Options:
  --remote <name>         Git remote (default: origin)
  --force-with-lease      Push with --force-with-lease
  --no-fetch              Skip fetch before ahead/behind check
  -h, --help              Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      remote=${2:-}
      shift 2
      ;;
    --force-with-lease)
      force_with_lease=true
      shift
      ;;
    --no-fetch)
      no_fetch=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${remote}" ]]; then
  echo "Remote name cannot be empty." >&2
  exit 1
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Not a git repository." >&2
  exit 1
}

git remote get-url "${remote}" >/dev/null 2>&1 || {
  echo "Remote '${remote}' not found." >&2
  exit 1
}

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "${current_branch}" != "${main_branch}" ]]; then
  echo "Current branch is '${current_branch}'. Switch to '${main_branch}' before running this script." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash changes before pushing '${main_branch}'." >&2
  exit 1
fi

if [[ "${no_fetch}" != "true" ]]; then
  git fetch "${remote}" "${main_branch}" --prune
fi

if ! git rev-parse --verify "${remote}/${main_branch}" >/dev/null 2>&1; then
  echo "Remote branch '${remote}/${main_branch}' does not exist." >&2
  exit 1
fi

counts=$(git rev-list --left-right --count "${remote}/${main_branch}...${main_branch}")
behind=$(awk '{print $1}' <<<"${counts}")
ahead=$(awk '{print $2}' <<<"${counts}")

if [[ "${behind}" -gt 0 ]]; then
  echo "Local '${main_branch}' is behind '${remote}/${main_branch}' by ${behind} commit(s)." >&2
  echo "Run: git pull --rebase ${remote} ${main_branch}" >&2
  exit 1
fi

if [[ "${ahead}" -eq 0 ]]; then
  echo "Nothing to push. '${main_branch}' is already up to date with '${remote}/${main_branch}'."
  exit 0
fi

if [[ "${force_with_lease}" == "true" ]]; then
  git push --force-with-lease "${remote}" "${main_branch}"
else
  git push "${remote}" "${main_branch}"
fi

echo "Pushed ${ahead} commit(s) from '${main_branch}' to '${remote}/${main_branch}'."
