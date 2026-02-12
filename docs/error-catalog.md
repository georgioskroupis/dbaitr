Version: 2025.09
Last updated: 2025-09-01
Owner: Platform Engineering
Non-negotiables:
- Do not leak provider/raw errors to clients
- Map common failures to stable app codes
- Keep 401/403/423/429/440 semantics consistent platform-wide
Acceptance: Codes align with handlers and docs

Standardized API Error Semantics

- 401 UNAUTHENTICATED
  - Codes: unauthenticated, unauthenticated_appcheck
  - Meaning: Missing or invalid ID token and/or App Check token
- 403 FORBIDDEN
  - Code: forbidden
  - Meaning: Lacks required role/capability
- 423 LOCKED
  - Code: locked
  - Meaning: Status blocks action (e.g., Suspended)
- 429 TOO MANY REQUESTS
  - Code: rate_limited
  - Meaning: Per-IP or per-user limiter triggered
- 440 LOGIN TIMEOUT
  - Code: login_timeout
  - Meaning: Token expired; client should refresh or reauthenticate
- 500 SERVER ERROR
  - Code: server_error
  - Meaning: Unhandled failure; inspect logs

YouTube integration app codes
- Create: 409 youtube_not_connected, 409 live_streaming_not_enabled, 409 live_embedding_not_allowed
- Ingest: 400 no_stream, 404 stream_not_found, 409 youtube_not_connected, 409 no_ingestion_info
- Transition: 400 invalid_transition, 409 stream_not_bound, 409 stream_inactive, 409 too_early, 409 youtube_not_connected, 409 live_streaming_not_enabled

Identity/profile app codes
- Profile bootstrap: 422 full_name_required
- Personhood challenge: 429 rate_limited, 400 invalid_challenge, 409 challenge_expired, 409 challenge_used
- Personhood proof verify: 400 invalid_proof, 409 duplicate_identity, 400 verification_failed, 503 verification_unavailable, 500 server_error
- Personhood result: 200 not_verified (when claim is not yet verified)

Notes
- API responses include `{ ok: boolean, error?: string, requestId?: string }` for tracing.
