#!/usr/bin/env bash
set -euo pipefail

# enforce-main-protection.sh — Apply standardized branch protection to main.
#
# Defaults are tuned for this repo's CI/CD model:
# - PRs required on main
# - Required status check: Quality Gate
# - Strict status checks (branch must be up to date)
# - Admins also enforced
# - No force push / no branch deletion
# - Linear history + conversation resolution required
#
# Usage:
#   bash scripts/ops/enforce-main-protection.sh
#   bash scripts/ops/enforce-main-protection.sh --repo owner/repo --branch main --check-context "Quality Gate"

repo="${GH_REPO:-}"
branch="main"
check_context="Quality Gate"
required_approvals=0
enforce_admins=true
dry_run=false

usage() {
  cat <<USAGE
Usage: bash scripts/ops/enforce-main-protection.sh [options]

Options:
  --repo <owner/repo>      GitHub repository (default: GH_REPO or gh repo view)
  --branch <name>          Branch to protect (default: main)
  --check-context <name>   Required status check context (default: Quality Gate)
  --approvals <0-6>        Required approving reviews (default: 0)
  --enforce-admins         Apply rules to admins (default)
  --no-enforce-admins      Do not apply rules to admins
  --dry-run                Print the payload and current protection only
  -h, --help               Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      repo=${2:-}
      shift 2
      ;;
    --branch)
      branch=${2:-}
      shift 2
      ;;
    --check-context)
      check_context=${2:-}
      shift 2
      ;;
    --approvals)
      required_approvals=${2:-}
      shift 2
      ;;
    --enforce-admins)
      enforce_admins=true
      shift
      ;;
    --no-enforce-admins)
      enforce_admins=false
      shift
      ;;
    --dry-run)
      dry_run=true
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

if [[ -z "${branch}" ]]; then
  echo "Branch name cannot be empty." >&2
  exit 1
fi
if [[ -z "${check_context}" ]]; then
  echo "Check context cannot be empty." >&2
  exit 1
fi
if ! [[ "${required_approvals}" =~ ^[0-6]$ ]]; then
  echo "--approvals must be an integer from 0 to 6." >&2
  exit 1
fi

payload_file=$(mktemp)
trap 'rm -f "${payload_file}"' EXIT

cat > "${payload_file}" <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "${check_context}"
    ]
  },
  "enforce_admins": ${enforce_admins},
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": ${required_approvals}
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON

echo "Repository: ${repo}"
echo "Branch: ${branch}"
echo "Required check: ${check_context}"
echo "Required approvals: ${required_approvals}"
echo "Enforce admins: ${enforce_admins}"

if [[ "${dry_run}" == "true" ]]; then
  echo
  echo "Planned payload:"
  cat "${payload_file}"
  echo
  echo "Current protection (if any):"
  gh api "repos/${repo}/branches/${branch}/protection" || true
  exit 0
fi

gh api --method PUT "repos/${repo}/branches/${branch}/protection" --input "${payload_file}" >/dev/null

echo "Applied branch protection."

echo "Verification summary:"
gh api "repos/${repo}/branches/${branch}/protection" --jq '{
  required_status_checks: .required_status_checks.checks,
  enforce_admins: .enforce_admins.enabled,
  required_pull_request_reviews: .required_pull_request_reviews,
  required_linear_history: .required_linear_history.enabled,
  allow_force_pushes: .allow_force_pushes.enabled,
  allow_deletions: .allow_deletions.enabled,
  required_conversation_resolution: .required_conversation_resolution.enabled
}'
