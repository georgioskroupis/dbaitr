# Repo Secrets Setup (GitHub Actions)

This project uses GitHub Actions for deployments and needs repository secrets.

## Quick Start via GitHub CLI

1) Install and login:
- `gh auth login`

2) Prepare env file:
- Copy `scripts/ops/gh-secrets.example.env` to a secure path and edit values.

3) Run the helper:
- `./scripts/ops/gh-secrets.sh /path/to/gh-secrets.env`

Notes:
- `FIREBASE_SERVICE_ACCOUNT_FILE` must point to a local JSON file; it’s piped directly into the secret.
- If not running inside the repo, set `GH_REPO=owner/repo` in the env file.
- You can rerun to update values safely.
- If `gcloud` is installed, the helper script also verifies the deploy service account has required IAM roles and prints exact grant commands when missing.

## Required Secrets

- Firebase: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`
- GCP deploy: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`
- Personhood verification: `IDV_SELF_VERIFY_URL`, `IDV_DEDUP_HMAC_SECRET`, optional `IDV_SELF_START_URL`, optional `IDV_SELF_VERIFY_API_KEY`, optional runtime values `IDV_CHALLENGE_TTL_MS`, `IDV_SELF_VERIFY_TIMEOUT_MS`
- AI/Moderation: `HUGGINGFACE_API_KEY` (AI-assist detection), `PERSPECTIVE_API_KEY` (toxicity filter)
 - Transparency workflow: `FIREBASE_SERVICE_ACCOUNT_B64` (base64 of service account JSON for Admin SDK)

## Deploy Service Account Roles (required)

For `FIREBASE_SERVICE_ACCOUNT` used by `.github/workflows/deploy.yml`, ensure the service account has:

- `roles/firebase.admin`
- `roles/serviceusage.serviceUsageConsumer`

Without `serviceUsageConsumer`, deploy may fail with:
- `PERMISSION_DENIED`
- `Caller does not have required permission to use project`
- `Failed to get Firebase project`

Verify bindings:

```bash
gcloud projects get-iam-policy db8app \
  --flatten='bindings[].members' \
  --filter='bindings.members:serviceAccount:<SERVICE_ACCOUNT_EMAIL>' \
  --format='value(bindings.role)'
```

## Create `FIREBASE_SERVICE_ACCOUNT_B64`

- Download a Firebase service account JSON with Firestore access (e.g., roles/datastore.user).
- Base64-encode it and add as a GitHub secret:
  - macOS/Linux: `base64 -w0 path/to/key.json | pbcopy` (or `| tr -d '\n'`)
  - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\key.json"))`
- In GitHub repo → Settings → Secrets → Actions → New repository secret → Name: `FIREBASE_SERVICE_ACCOUNT_B64` → paste value.

The scheduled workflow `.github/workflows/update-transparency.yml` reads this secret and updates `analytics/transparency` daily.

Now merges to `main` will build with these envs and deploy to Firebase Hosting (dbaitr.com).
