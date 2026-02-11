#!/usr/bin/env bash
set -euo pipefail

# deploy-production.sh — Dispatch and verify production deploy workflow.
#
# Usage:
#   bash scripts/ops/deploy-production.sh [--target-ref <ref>] [--workflow-ref <ref>] [--repo <owner/repo>] [--no-wait] [--skip-health]

workflow_name="Deploy to Firebase Hosting"
repo="${GH_REPO:-}"
target_ref="main"
workflow_ref="main"
wait_for_run=true
skip_health=false

usage() {
  cat <<USAGE
Usage: bash scripts/ops/deploy-production.sh [options]

Options:
  --target-ref <ref>     Git ref to deploy (default: main)
  --workflow-ref <ref>   Ref that contains workflow definitions (default: main)
  --repo <owner/repo>    GitHub repository (default: GH_REPO or gh repo view)
  --no-wait              Do not wait for workflow completion
  --skip-health          Skip post-run health checks from this script
  -h, --help             Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-ref)
      target_ref=${2:-}
      shift 2
      ;;
    --workflow-ref)
      workflow_ref=${2:-}
      shift 2
      ;;
    --repo)
      repo=${2:-}
      shift 2
      ;;
    --no-wait)
      wait_for_run=false
      shift
      ;;
    --skip-health)
      skip_health=true
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
command -v curl >/dev/null 2>&1 || {
  echo "curl is required." >&2
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

if [[ -z "${target_ref}" ]]; then
  echo "target ref cannot be empty" >&2
  exit 1
fi
if [[ -z "${workflow_ref}" ]]; then
  echo "workflow ref cannot be empty" >&2
  exit 1
fi

start_epoch=$(date +%s)

echo "Dispatching '${workflow_name}' on '${repo}' (target-ref='${target_ref}', workflow-ref='${workflow_ref}')..."
gh workflow run "${workflow_name}" \
  --repo "${repo}" \
  --ref "${workflow_ref}" \
  -f "ref=${target_ref}"

echo "Workflow dispatched."

if [[ "${wait_for_run}" != "true" ]]; then
  echo "Tip: watch runs with: gh run list --repo ${repo} --workflow \"${workflow_name}\""
  exit 0
fi

run_id=""
for _ in {1..30}; do
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
  echo "Failed to locate dispatched deploy run. Check manually:" >&2
  echo "gh run list --repo ${repo} --workflow \"${workflow_name}\"" >&2
  exit 1
fi

echo "Watching deploy run ${run_id}..."
gh run watch "${run_id}" --repo "${repo}"

conclusion=$(gh run view "${run_id}" --repo "${repo}" --json conclusion -q .conclusion)
if [[ "${conclusion}" != "success" ]]; then
  echo "Deploy run ${run_id} concluded with: ${conclusion}" >&2
  exit 1
fi

if [[ "${skip_health}" == "true" ]]; then
  echo "Deploy workflow succeeded. Health checks skipped by flag."
  exit 0
fi

check_url() {
  local url="$1"
  local tmp_file
  local status
  local body
  tmp_file=$(mktemp)

  for attempt in {1..18}; do
    status=$(curl -sS -o "${tmp_file}" -w "%{http_code}" "${url}" || true)
    body=$(cat "${tmp_file}" 2>/dev/null || true)
    if [[ "${status}" == "200" ]] && [[ "${body}" == *'"ok":true'* ]]; then
      echo "Health OK for ${url} (attempt ${attempt})."
      rm -f "${tmp_file}"
      return 0
    fi
    echo "Health retry ${attempt}/18 for ${url} (status=${status})."
    sleep 10
  done

  echo "Health check failed for ${url}." >&2
  cat "${tmp_file}" >&2 || true
  rm -f "${tmp_file}"
  return 1
}

check_url "https://dbaitr.com/api/health"
check_url "https://studio--db8app.us-central1.hosted.app/api/health"

echo "Deploy and health verification succeeded."
