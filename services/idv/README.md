# IDV Self-Hosted Service

This service provides a self-hosted verifier backend for Self/OpenPassport.

## Endpoints

- `GET /health`
- `POST /start` (internal, requires `X-Idv-Api-Key`)
  - Input: `{ uid, challengeId, challenge, expiresAtMs }`
  - Output: `{ ok, verificationUrl, sessionId }`
- `POST /verify` (internal, requires `X-Idv-Api-Key`)
  - Accepts either:
    - Self relayer payload: `{ attestationId, proof, publicSignals, userContextData }`
    - Wrapped payload from app route: `{ challengeId, challenge, proof: { ...self payload... } }`
  - Output success: `{ verified: true, nullifier, challengeId, challenge, ... }`

## Required env vars

- `IDV_SHARED_API_KEY` (must match app secret `IDV_SELF_VERIFY_API_KEY`)
- `SELF_SCOPE_SEED` (example: `dbaitr-human-v1`)
- `PUBLIC_APP_URL` (example: `https://dbaitr.com`)

## Optional env vars

- `SELF_ENDPOINT` (defaults to `${PUBLIC_APP_URL}/api/idv/relay`)
- `SELF_ENDPOINT_TYPE` (`https`, `staging_https`, `celo`, `staging_celo`)
- `SELF_APP_NAME` (default `dbaitr`)
- `SELF_APP_LOGO_URL` (default `https://dbaitr.com/logo.png`)
- `SELF_MOCK_PASSPORT` (`true`/`false`, default `false`)
- `SELF_MINIMUM_AGE` (default `18`)
- `SELF_EXCLUDED_COUNTRIES` (comma-separated)
- `SELF_OFAC` (`true`/`false`, default `false`)

## Local run

```bash
cd services/idv
npm install
PORT=8080 \
IDV_SHARED_API_KEY=replace-me \
SELF_SCOPE_SEED=dbaitr-human-v1 \
PUBLIC_APP_URL=http://localhost:9002 \
npm start
```
