#!/usr/bin/env bash
set -euo pipefail

# trigger-ci.sh — Explicitly dispatch the CI workflow via GitHub Actions.
#
# Usage:
#   bash scripts/ops/trigger-ci.sh [--ref <git-ref>] [--repo <owner/repo>] [--wait]
#
# Defaults:
#   ref: current git branch
#   repo: GH_REPO env or detected from `gh repo view`

workflow_name="CI"
ref=""
repo="${GH_REPO:-}"
wait_for_run=false

usage() {
  cat <<USAGE
Usage: bash scripts/ops/trigger-ci.sh [options]

Options:
  --ref <git-ref>       Branch/tag/SHA to run CI against (default: current branch)
  --repo <owner/repo>   GitHub repository (default: GH_REPO or gh repo view)
  --wait                Wait for completion and fail on non-success
  -h, --help            Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      ref=${2:-}
      shift 2
      ;;
    --repo)
      repo=${2:-}
      shift 2
      ;;
    --wait)
      wait_for_run=true
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

command -v gh >/dev/null 2>&1 || {
  echo "GitHub CLI (gh) is required." >&2
  exit 1
}

gh auth status >/dev/null 2>&1 || {
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
}

if [[ -z "${repo}" ]]; then
  repo=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
fi
if [[ -z "${repo}" ]]; then
  echo "Could not determine repository. Pass --repo owner/repo or set GH_REPO." >&2
  exit 1
fi

if [[ -z "${ref}" ]]; then
  ref=$(git symbolic-ref --short -q HEAD 2>/dev/null || true)
fi
if [[ -z "${ref}" ]]; then
  echo "Could not determine current branch. Pass --ref explicitly." >&2
  exit 1
fi

start_epoch=$(date +%s)

echo "Dispatching '${workflow_name}' on '${repo}' for ref '${ref}'..."
gh workflow run "${workflow_name}" --repo "${repo}" --ref "${ref}"

echo "Workflow dispatched."

if [[ "${wait_for_run}" != "true" ]]; then
  echo "Tip: watch runs with: gh run list --repo ${repo} --workflow \"${workflow_name}\""
  exit 0
fi

run_id=""
for _ in {1..24}; do
  run_id=$(gh run list \
    --repo "${repo}" \
    --workflow "${workflow_name}" \
    --json databaseId,createdAt,event,status \
    --limit 20 | node -e '
const fs=require("fs");
const start=Number(process.argv[1]);
const runs=JSON.parse(fs.readFileSync(0,"utf8"));
const candidates=(runs||[])
  .filter(r=>r.event==="workflow_dispatch")
  .filter(r=>Math.floor(Date.parse(r.createdAt)/1000) >= start - 5)
  .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
if(candidates[0]?.databaseId) process.stdout.write(String(candidates[0].databaseId));
' "${start_epoch}")
  if [[ -n "${run_id}" ]]; then
    break
  fi
  sleep 5
done

if [[ -z "${run_id}" ]]; then
  echo "Failed to locate dispatched run. Check manually:" >&2
  echo "gh run list --repo ${repo} --workflow \"${workflow_name}\"" >&2
  exit 1
fi

echo "Watching run ${run_id}..."
gh run watch "${run_id}" --repo "${repo}"

conclusion=$(gh run view "${run_id}" --repo "${repo}" --json conclusion -q .conclusion)
if [[ "${conclusion}" != "success" ]]; then
  echo "CI run ${run_id} concluded with: ${conclusion}" >&2
  exit 1
fi

echo "CI run ${run_id} completed successfully."
