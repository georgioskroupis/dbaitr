#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/ops/gh-secrets.sh path/to/gh-secrets.env
#
# Requires:
#   - GitHub CLI installed and authenticated: gh auth login
#   - Repo is the current working directory or set GH_REPO env (owner/repo)
#   - An env file containing required variables (see scripts/ops/gh-secrets.example.env)

DRY_RUN=${DRY_RUN:-0}

if [[ "$DRY_RUN" != "1" ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "Error: GitHub CLI (gh) is not installed. Install from https://cli.github.com/" >&2
    exit 1
  fi
fi

ENV_FILE=${1:-}
if [[ -z "${ENV_FILE}" || ! -f "${ENV_FILE}" ]]; then
  echo "Error: Provide env file path (see scripts/ops/gh-secrets.example.env)." >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

# Detect repo or use GH_REPO
REPO=${GH_REPO:-}
if [[ -z "${REPO}" ]]; then
  # Try to infer from git remote
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    ORIGIN_URL=$(git remote get-url origin 2>/dev/null || true)
    if [[ "${ORIGIN_URL}" =~ github.com[:/](.+/.+)\.git ]]; then
      REPO="${BASH_REMATCH[1]}"
    fi
  fi
fi
if [[ -z "${REPO}" ]]; then
  echo "Error: Could not determine GitHub repo. Set GH_REPO=owner/repo or run inside the repo." >&2
  exit 1
fi

echo "Setting secrets on repo: ${REPO}${DRY_RUN:+ (dry-run)}"

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ $*"
  else
    eval "$@"
  fi
}

# Firebase
[[ -z "${FIREBASE_PROJECT_ID:-}" ]] && { echo "Missing FIREBASE_PROJECT_ID" >&2; exit 1; }
[[ -z "${FIREBASE_SERVICE_ACCOUNT_FILE:-}" ]] && { echo "Missing FIREBASE_SERVICE_ACCOUNT_FILE" >&2; exit 1; }

run gh secret set FIREBASE_PROJECT_ID --repo "${REPO}" -b "${FIREBASE_PROJECT_ID}"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "+ gh secret set FIREBASE_SERVICE_ACCOUNT --repo \"${REPO}\" < \"${FIREBASE_SERVICE_ACCOUNT_FILE}\""
else
  gh secret set FIREBASE_SERVICE_ACCOUNT --repo "${REPO}" < "${FIREBASE_SERVICE_ACCOUNT_FILE}"
fi

# Cloud Run / GCP
[[ -z "${GCP_PROJECT_ID:-}" ]] && { echo "Missing GCP_PROJECT_ID" >&2; exit 1; }
[[ -z "${GCP_REGION:-}" ]] && { echo "Missing GCP_REGION" >&2; exit 1; }
[[ -z "${GCP_WORKLOAD_IDENTITY_PROVIDER:-}" ]] && { echo "Missing GCP_WORKLOAD_IDENTITY_PROVIDER" >&2; exit 1; }
[[ -z "${GCP_SERVICE_ACCOUNT_EMAIL:-}" ]] && { echo "Missing GCP_SERVICE_ACCOUNT_EMAIL" >&2; exit 1; }

run gh secret set GCP_PROJECT_ID --repo "${REPO}" -b "${GCP_PROJECT_ID}"
run gh secret set GCP_REGION --repo "${REPO}" -b "${GCP_REGION}"
run gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "${REPO}" -b "${GCP_WORKLOAD_IDENTITY_PROVIDER}"
run gh secret set GCP_SERVICE_ACCOUNT_EMAIL --repo "${REPO}" -b "${GCP_SERVICE_ACCOUNT_EMAIL}"

if [[ -n "${CLOUD_RUN_SERVICE_IDV:-}" ]]; then
  run gh secret set CLOUD_RUN_SERVICE_IDV --repo "${REPO}" -b "${CLOUD_RUN_SERVICE_IDV}"
fi

# App runtime env
run gh secret set NEXT_PUBLIC_FIREBASE_API_KEY --repo "${REPO}" -b "${NEXT_PUBLIC_FIREBASE_API_KEY:-}"
run gh secret set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN --repo "${REPO}" -b "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-}"
run gh secret set NEXT_PUBLIC_FIREBASE_PROJECT_ID --repo "${REPO}" -b "${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-}"
run gh secret set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET --repo "${REPO}" -b "${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-}"
run gh secret set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --repo "${REPO}" -b "${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-}"
run gh secret set NEXT_PUBLIC_FIREBASE_APP_ID --repo "${REPO}" -b "${NEXT_PUBLIC_FIREBASE_APP_ID:-}"
run gh secret set NEXT_PUBLIC_IDV_ONDEVICE --repo "${REPO}" -b "${NEXT_PUBLIC_IDV_ONDEVICE:-true}"
run gh secret set NEXT_PUBLIC_IDV_AI_APPROVAL --repo "${REPO}" -b "${NEXT_PUBLIC_IDV_AI_APPROVAL:-true}"
run gh secret set NEXT_PUBLIC_IDV_STRICT_MINIMAL --repo "${REPO}" -b "${NEXT_PUBLIC_IDV_STRICT_MINIMAL:-true}"
run gh secret set NEXT_PUBLIC_HUMAN_MODELS_URL --repo "${REPO}" -b "${NEXT_PUBLIC_HUMAN_MODELS_URL:-/vendor/human/models/}"
run gh secret set NEXT_PUBLIC_TESSERACT_BASE_URL --repo "${REPO}" -b "${NEXT_PUBLIC_TESSERACT_BASE_URL:-/vendor/tesseract/}"
run gh secret set NEXT_ENABLE_IDV_CSP --repo "${REPO}" -b "${NEXT_ENABLE_IDV_CSP:-false}"

if [[ -n "${CLOUD_RUN_IDV_URL:-}" ]]; then
  run gh secret set CLOUD_RUN_IDV_URL --repo "${REPO}" -b "${CLOUD_RUN_IDV_URL}"
else
  echo "Note: CLOUD_RUN_IDV_URL not set yet; deploy Cloud Run then set this secret."
fi

echo "All requested secrets have been set."
