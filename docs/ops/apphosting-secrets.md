# App Hosting secrets (Firebase + Secret Manager)

Use this guide to configure server-only secrets for Firebase App Hosting.

## Prerequisites
- Firebase CLI v13.15.4+ installed and logged in
- gcloud CLI installed and configured
- `PROJECT_ID` set (e.g., `export PROJECT_ID=db8app`)

## Quick script (recommended)
Run the helper script to create/update secrets and grant access to App Hosting:

```
PROJECT_ID=db8app \
BACKEND_ID="<your-backend-id>" \
STRIPE_SECRET_KEY="sk_live_..." \
STRIPE_WEBHOOK_SECRET="whsec_..." \
GEMINI_API_KEY="AIza..." \
bash scripts/ops/apphosting-secrets.sh
```

- Interactive mode (prompts for missing values):

```
PROJECT_ID=db8app bash scripts/ops/apphosting-secrets.sh

To get your BACKEND_ID:

```
firebase apphosting:backends:list --project db8app
```

If you omit BACKEND_ID and only one backend exists, the script will try to auto-detect it.
```

## Manual (CLI) alternative
If you prefer to set secrets manually:

```
# Create or update secrets in Secret Manager
printf '%s' "$STRIPE_SECRET_KEY" | gcloud secrets versions add STRIPE_SECRET_KEY --data-file=- --project "$PROJECT_ID"
printf '%s' "$STRIPE_WEBHOOK_SECRET" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --data-file=- --project "$PROJECT_ID"
printf '%s' "$GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project "$PROJECT_ID"
printf '%s' "$IDV_SELF_VERIFY_URL" | gcloud secrets versions add IDV_SELF_VERIFY_URL --data-file=- --project "$PROJECT_ID"
printf '%s' "$IDV_DEDUP_HMAC_SECRET" | gcloud secrets versions add IDV_DEDUP_HMAC_SECRET --data-file=- --project "$PROJECT_ID"

# Grant access for App Hosting backend to read these secrets
firebase apphosting:secrets:grantaccess STRIPE_SECRET_KEY --project "$PROJECT_ID"
firebase apphosting:secrets:grantaccess STRIPE_WEBHOOK_SECRET --project "$PROJECT_ID"
firebase apphosting:secrets:grantaccess GEMINI_API_KEY --project "$PROJECT_ID"
firebase apphosting:secrets:grantaccess IDV_SELF_VERIFY_URL --project "$PROJECT_ID"
firebase apphosting:secrets:grantaccess IDV_DEDUP_HMAC_SECRET --project "$PROJECT_ID"
```

## Wire into your app
The `apphosting.yaml` in the repo already references these secrets:

```
env:
  - variable: STRIPE_SECRET_KEY
    secret: STRIPE_SECRET_KEY
    availability: [RUNTIME]

  - variable: STRIPE_WEBHOOK_SECRET
    secret: STRIPE_WEBHOOK_SECRET
    availability: [RUNTIME]

  - variable: GEMINI_API_KEY
    secret: GEMINI_API_KEY
    availability: [RUNTIME]

  - variable: IDV_SELF_VERIFY_URL
    secret: IDV_SELF_VERIFY_URL
    availability: [RUNTIME]

  - variable: IDV_DEDUP_HMAC_SECRET
    secret: IDV_DEDUP_HMAC_SECRET
    availability: [RUNTIME]
```

No code changes are required. App Hosting resolves secrets during rollout and exposes them at runtime.

## Public env (NEXT_PUBLIC_*)
Public variables are configured as values in `apphosting.yaml` and are available at build & runtime. Update if needed:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_URL`

Server runtime values configured in `apphosting.yaml`:
- `IDV_CHALLENGE_TTL_MS`
- `IDV_SELF_VERIFY_TIMEOUT_MS`

## Rollout
Commit and push `apphosting.yaml` changes to the branch with automatic rollouts enabled. Monitor deployment in:

- Firebase Console → App Hosting → Deployments → Logs
- Cloud Console → Cloud Build and Cloud Run logs
