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

## Required Secrets

- Firebase: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`
- Cloud Run: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, optional `CLOUD_RUN_SERVICE_IDV`
- App runtime: `NEXT_PUBLIC_IDV_ONDEVICE`, `NEXT_PUBLIC_IDV_AI_APPROVAL`, `NEXT_PUBLIC_IDV_STRICT_MINIMAL`, `NEXT_PUBLIC_HUMAN_MODELS_URL`, `NEXT_PUBLIC_TESSERACT_BASE_URL`, `NEXT_ENABLE_IDV_CSP`, and (after deploy) `CLOUD_RUN_IDV_URL`
- AI/Moderation: `HUGGINGFACE_API_KEY` (AI-assist detection), `PERSPECTIVE_API_KEY` (toxicity filter)
 - Transparency workflow: `FIREBASE_SERVICE_ACCOUNT_B64` (base64 of service account JSON for Admin SDK)

## Create `FIREBASE_SERVICE_ACCOUNT_B64`

- Download a Firebase service account JSON with Firestore access (e.g., roles/datastore.user).
- Base64-encode it and add as a GitHub secret:
  - macOS/Linux: `base64 -w0 path/to/key.json | pbcopy` (or `| tr -d '\n'`)
  - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\key.json"))`
- In GitHub repo → Settings → Secrets → Actions → New repository secret → Name: `FIREBASE_SERVICE_ACCOUNT_B64` → paste value.

The scheduled workflow `.github/workflows/update-transparency.yml` reads this secret and updates `analytics/transparency` daily.

## After Cloud Run Deploy

- Run the GitHub Action “Deploy IDV Service to Cloud Run”
- Copy the service URL, then:
  - `gh secret set CLOUD_RUN_IDV_URL -b "https://<service-url>"`

Now merges to `main` will build with these envs and deploy to Firebase Hosting (dbaitr.com).
