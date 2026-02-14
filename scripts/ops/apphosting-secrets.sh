#!/usr/bin/env bash
set -euo pipefail

# Configure Firebase App Hosting secrets via Cloud Secret Manager and grant access.
#
# Usage:
#   PROJECT_ID=db8app bash scripts/ops/apphosting-secrets.sh \
#     --stripe-key "$STRIPE_SECRET_KEY" \
#     --stripe-webhook "$STRIPE_WEBHOOK_SECRET" \
#     --gemini-key "$GEMINI_API_KEY"
#
# Or interactively (prompts for missing values):
#   PROJECT_ID=db8app bash scripts/ops/apphosting-secrets.sh
#
# Options:
#   --stripe-key VALUE        Set STRIPE_SECRET_KEY
#   --stripe-webhook VALUE    Set STRIPE_WEBHOOK_SECRET
#   --gemini-key VALUE        Set GEMINI_API_KEY
#   --idv-verify-url VALUE    Set IDV_SELF_VERIFY_URL
#   --idv-start-url VALUE     Set IDV_SELF_START_URL
#   --idv-api-key VALUE       Set IDV_SELF_VERIFY_API_KEY (optional)
#   --idv-dedup VALUE         Set IDV_DEDUP_HMAC_SECRET
#   --dry-run                 Print actions without applying

project_id="${PROJECT_ID:-}"
backend_id="${BACKEND_ID:-}"
dry_run=false
stripe_key=""
stripe_webhook=""
gemini_key=""
idv_verify_url="${IDV_SELF_VERIFY_URL:-}"
idv_start_url="${IDV_SELF_START_URL:-}"
idv_api_key="${IDV_SELF_VERIFY_API_KEY:-}"
idv_dedup_secret="${IDV_DEDUP_HMAC_SECRET:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stripe-key) stripe_key=${2:-}; shift 2;;
    --stripe-webhook) stripe_webhook=${2:-}; shift 2;;
    --gemini-key) gemini_key=${2:-}; shift 2;;
    --idv-verify-url) idv_verify_url=${2:-}; shift 2;;
    --idv-start-url) idv_start_url=${2:-}; shift 2;;
    --idv-api-key) idv_api_key=${2:-}; shift 2;;
    --idv-dedup) idv_dedup_secret=${2:-}; shift 2;;
    --dry-run) dry_run=true; shift;;
    --backend) backend_id=${2:-}; shift 2;;
    *) echo "Unknown option: $1" >&2; exit 1;;
  esac
done

if [[ -z "$project_id" ]]; then
  if [[ -f .firebaserc ]]; then
    project_id=$(node -e "const f=require('./.firebaserc');console.log(f.projects?.default||'')" 2>/dev/null || true)
  fi
fi
if [[ -z "$project_id" ]]; then
  echo "PROJECT_ID not set. Export PROJECT_ID or add .firebaserc with a default project." >&2
  exit 1
fi

echo "Project: $project_id"
if [[ -n "$backend_id" ]]; then
  echo "Backend: $backend_id"
fi

prompt_secret() {
  local name="$1"; local varref="$2"; local value="${!varref:-}"
  if [[ -z "$value" ]]; then
    read -r -s -p "Enter value for $name: " value; echo
    printf -v "$varref" '%s' "$value"
  fi
}

prompt_secret STRIPE_SECRET_KEY stripe_key
prompt_secret STRIPE_WEBHOOK_SECRET stripe_webhook
prompt_secret GEMINI_API_KEY gemini_key

ensure_secret() {
  local name="$1"; local value="$2";
  echo "Configuring secret '$name'..."
  if $dry_run; then
    echo "DRY_RUN: would create secret $name (if missing) and add new version"
  else
    # Create secret if it doesn't exist
    gcloud secrets describe "$name" --project "$project_id" >/dev/null 2>&1 || \
      gcloud secrets create "$name" --replication-policy="automatic" --project "$project_id"
    # Add a new version
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project "$project_id" >/dev/null
  fi
  # Grant App Hosting backend access
  if $dry_run; then
    echo "DRY_RUN: would grant access for backend '$backend_id'"
  else
    if [[ -z "$backend_id" ]]; then
      echo "Attempting to auto-detect BACKEND_ID (listing App Hosting backends)..."
      # Try to get the first backend id via JSON
      backend_id=$(firebase apphosting:backends:list --project "$project_id" --json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const b=(j.backends||[])[0]?.backendId;console.log(b||'')}catch(e){console.log('')}})" || true)
      if [[ -z "$backend_id" ]]; then
        echo "Could not auto-detect BACKEND_ID. Please run:\n  firebase apphosting:backends:list --project $project_id\nand rerun this script with --backend <BACKEND_ID> or set BACKEND_ID env var." >&2
        exit 1
      fi
      echo "Detected BACKEND_ID=$backend_id"
    fi
    firebase apphosting:secrets:grantaccess "$name" --project "$project_id" --backend "$backend_id"
  fi
}

ensure_secret_if_set() {
  local name="$1"; local value="$2";
  if [[ -z "$value" ]]; then
    echo "Skipping '$name' (no value provided)."
    return 0
  fi
  ensure_secret "$name" "$value"
}

if [[ -n "$idv_verify_url" ]]; then
  if [[ "$idv_verify_url" =~ ^https?:// ]]; then
    :
  else
    echo "IDV_SELF_VERIFY_URL must be an http(s) URL when provided." >&2
    exit 1
  fi
fi

if [[ -n "$idv_start_url" ]]; then
  if [[ "$idv_start_url" =~ ^https?:// ]]; then
    :
  else
    echo "IDV_SELF_START_URL must be an http(s) URL when provided." >&2
    exit 1
  fi
fi

if [[ -n "$idv_verify_url" && -z "$idv_dedup_secret" ]]; then
  echo "IDV_DEDUP_HMAC_SECRET is required when IDV_SELF_VERIFY_URL is provided." >&2
  exit 1
fi

ensure_secret STRIPE_SECRET_KEY "$stripe_key"
ensure_secret STRIPE_WEBHOOK_SECRET "$stripe_webhook"
ensure_secret GEMINI_API_KEY "$gemini_key"
ensure_secret_if_set IDV_SELF_VERIFY_URL "$idv_verify_url"
ensure_secret_if_set IDV_SELF_START_URL "$idv_start_url"
ensure_secret_if_set IDV_SELF_VERIFY_API_KEY "$idv_api_key"
ensure_secret_if_set IDV_DEDUP_HMAC_SECRET "$idv_dedup_secret"

echo "All secrets configured and access granted."
