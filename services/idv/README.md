# Identity Verification Service (Cloud Run)

A FastAPI service for privacy-first identity verification. Accepts three images (`front`, `back`, `selfie`) via multipart form-data, performs ephemeral checks (quality, PDF417 detection, face similarity with InsightFace), and returns only `{ approved: boolean, reason?: string }`.

- No PII persisted, no payloads logged.
- To be extended with MRZ/PDF417 decoding, face match, and anti-spoof.

## Run locally
- Python 3.10+
- Install: `pip install -r requirements.txt`
- Start: `uvicorn app:app --host 0.0.0.0 --port 8000`

## Deploy (Cloud Run)
- Build: `docker build -t idv:latest .`
- Run: `docker run -p 8000:8000 idv:latest`
- Deploy to Cloud Run and set the URL in the Next.js app env: `CLOUD_RUN_IDV_URL`.

Notes:
- The Dockerfile installs system deps for OpenCV and ZBar (used by `pyzbar` for PDF417). If decoding PDF417 isn't needed server-side, you can remove `pyzbar` and `libzbar0`.
- InsightFace loads the `buffalo_l` model and runs on CPU by default (override via `ORT_PROVIDERS`).

## Response shape
```
{ "approved": true, "reason": null }
```

`reason` is a short machine-readable string for UX to display helpful context.
