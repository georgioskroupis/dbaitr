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
