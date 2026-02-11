Diagnostics (Auth/App Check)

API
- GET /api/admin/diagnostics (admin-only). Supports filters via query:
  - code: e.g., rate_limited, unauthenticated_appcheck, forbidden, locked
  - route: path filter (exact match)
  - window: 1h | 24h | 7d (default 24h)
- Returns: latest items (limited) and aggregates keyed by "route|code".

UI
- /admin/diagnostics: filters for code, route, and window. Shows latest denials and aggregate counts.

Retention
- Best-effort prune of denials older than 30 days is performed during diagnostics API access. For stricter control, add a scheduled cleanup to delete the oldest docs beyond 10k records.

YouTube Live Codes

Live Ingest Lookup (`/api/live/[id]/ingest`)
- 404 not_found: Debate doc missing.
- 403 forbidden: Only creator or admin can fetch ingest.
- 400 no_stream: Missing `youtube.streamId` on doc.
- 404 stream_not_found: Stream id not found on YouTube.
- 409 youtube_not_connected: OAuth credentials missing/invalid; reconnect.
- 409 no_ingestion_info: Stream has no `cdn.ingestionInfo` yet; wait/recreate.
- 200 ok: Returns `{ ingestAddress, streamName }`.

Live Transition (`/api/live/[id]/transition`)
- 400 invalid_transition: Invalid sequence or failedPrecondition.
- 409 stream_not_bound: Broadcast not bound to expected stream.
- 409 stream_inactive: Stream not ACTIVE; start encoder and retry.
- 409 youtube_not_connected: Credentials missing/expired/revoked; reconnect.
- 409 live_streaming_not_enabled: Enable Live Streaming in YouTube Studio (can take up to 24h).

Ingest diagnostics
- authz.ok: withAuth success marker (dev-only) with requestId, uid, role, status.
- ingest.entry: first log in the handler with requestId and docId.
- ingest.docload: after Admin SDK read: { hasDoc, ownerOrPrivileged }.
- ingest.flags: booleans and masked values from doc.youtube: { hasStreamId, hasIngestAddress, hasStreamName, doc.youtube?.ingestAddress, doc.youtube?.streamName }.
- ingest.fastpath: immediate 200 path when both stored fields exist.
- ingest.preflight: mapped outcomes without provider call: not_found, forbidden, no_stream.
- ingest.provider: external call path; logs provider { httpStatus, reasons[] } and outcome.
- reasonPhase: every 500 includes reasonPhase in body indicating last phase (entry|authz|docload|flags|fastpath|preflight|provider|handler).
- Admin-only, dev-only diagnostics now require explicit env opt-in: `INGEST_DIAGNOSTICS_ENABLED=1`.
- With that flag enabled, `?diag=1` returns masked flags (no secrets) and `?forceFast=1` forces fast-path only for admin role.
- Auxiliary ingest diagnostics routes (`/ingest/ping`, `/ingest/bare`, `/ingest/min`, `/ingest/import-test`) are admin-only and return `404` unless `INGEST_DIAGNOSTICS_ENABLED=1`.
- Generic debug routes (`/api/debug/ping`, `/api/debug/echo`) are admin-only and return `404` unless `DEBUG_ENDPOINTS_ENABLED=1`.
Version: 2026.02
Last updated: 2026-02-11
Owner: Platform Engineering
Non-negotiables:
- Structured logs with requestId for protected APIs
- /admin/diagnostics supports filters and aggregates with retention pruning
- No secrets in logs; sanitize provider payloads
Acceptance: Route and logs align; operators can triage quickly
