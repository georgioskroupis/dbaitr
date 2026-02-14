#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-db8app}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-idv}"
PUBLIC_APP_URL="${PUBLIC_APP_URL:-https://dbaitr.com}"
SELF_SCOPE_SEED="${SELF_SCOPE_SEED:-dbaitr-human-v1}"
SELF_ENDPOINT="${SELF_ENDPOINT:-${PUBLIC_APP_URL}/api/idv/relay}"
SELF_ENDPOINT_TYPE="${SELF_ENDPOINT_TYPE:-https}"
SELF_APP_NAME="${SELF_APP_NAME:-dbaitr}"
SELF_APP_LOGO_URL="${SELF_APP_LOGO_URL:-https://dbaitr.com/logo.png}"
SELF_MOCK_PASSPORT="${SELF_MOCK_PASSPORT:-false}"
SELF_MINIMUM_AGE="${SELF_MINIMUM_AGE:-18}"
SELF_EXCLUDED_COUNTRIES="${SELF_EXCLUDED_COUNTRIES:-}"
SELF_OFAC="${SELF_OFAC:-false}"

echo "Deploying ${SERVICE_NAME} to ${PROJECT_ID}/${REGION}"
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --source services/idv \
  --platform managed \
  --allow-unauthenticated \
  --max-instances 5 \
  --set-env-vars "PUBLIC_APP_URL=${PUBLIC_APP_URL},SELF_SCOPE_SEED=${SELF_SCOPE_SEED},SELF_ENDPOINT=${SELF_ENDPOINT},SELF_ENDPOINT_TYPE=${SELF_ENDPOINT_TYPE},SELF_APP_NAME=${SELF_APP_NAME},SELF_APP_LOGO_URL=${SELF_APP_LOGO_URL},SELF_MOCK_PASSPORT=${SELF_MOCK_PASSPORT},SELF_MINIMUM_AGE=${SELF_MINIMUM_AGE},SELF_EXCLUDED_COUNTRIES=${SELF_EXCLUDED_COUNTRIES},SELF_OFAC=${SELF_OFAC}" \
  --set-secrets "IDV_SHARED_API_KEY=IDV_SELF_VERIFY_API_KEY:latest"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
echo "IDV service URL: ${SERVICE_URL}"

echo "Updating Secret Manager values for App Hosting verifier URLs..."
printf '%s' "${SERVICE_URL}/start" | gcloud secrets versions add IDV_SELF_START_URL --data-file=- --project "${PROJECT_ID}" >/dev/null
printf '%s' "${SERVICE_URL}/verify" | gcloud secrets versions add IDV_SELF_VERIFY_URL --data-file=- --project "${PROJECT_ID}" >/dev/null
echo "Secrets updated:"
echo "  IDV_SELF_START_URL=${SERVICE_URL}/start"
echo "  IDV_SELF_VERIFY_URL=${SERVICE_URL}/verify"
