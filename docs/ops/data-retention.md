# Data Minimization & Retention

This project practices data minimization — we only store what’s needed to provide the service, and we retain it for limited periods.

## Automated Cleanup (TTL)

We provide a GitHub Actions workflow and script to clean up old records:
- `idv_attempts`: deleted after 90 days (configurable via `IDV_TTL_DAYS`).
- `reports` with `status == "resolved"`: deleted after 180 days (configurable via `REPORTS_TTL_DAYS`).

Script: `scripts/ops/cleanup.mjs`
Workflow: `.github/workflows/cleanup.yml` (runs daily at 03:09 UTC)

Authentication for the script:
- Set one of these repo secrets:
  - `FIREBASE_SERVICE_ACCOUNT_B64`: base64 of the full service account JSON
  - or `FIREBASE_SERVICE_ACCOUNT`: full JSON as a raw secret (the workflow writes it to `$GOOGLE_APPLICATION_CREDENTIALS`)

You can also run locally:
```
GOOGLE_APPLICATION_CREDENTIALS=/abs/path/sa.json \
IDV_TTL_DAYS=90 REPORTS_TTL_DAYS=180 \
node scripts/ops/cleanup.mjs
```

## Firestore TTL Policy (Optional)

Firestore supports server-side TTL. Consider enabling TTL policies as a complement or alternative:
- For `idv_attempts`, set TTL on field `timestamp`.
- For `reports`, set TTL on field `resolvedAt` for `status == "resolved"`.

TTL is configured in the Google Cloud Console or via `gcloud`:
- https://cloud.google.com/firestore/docs/ttl/overview

Note: We kept an app-level cleanup script to avoid coupling TTL to environment-specific console settings and to allow nuanced logic.

## Encryption at Rest & In Transit

- All data in Firestore is encrypted at rest by Google Cloud using industry-standard encryption.
- All network access to the app and APIs uses TLS (HTTPS).
- If we add application-layer encryption (e.g., encrypting certain fields client-side), we will document:
  - The fields encrypted
  - Key management approach
  - Rotation procedures and recovery

At present, we rely on Firebase/Google Cloud’s encryption at rest and TLS in transit.
