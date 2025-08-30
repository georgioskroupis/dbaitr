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
