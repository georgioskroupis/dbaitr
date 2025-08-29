AI Topic Pills — On‑Call Runbook

Scope
- End-to-end topic pills classification across six categories, scheduled + event triggers.

Key Endpoints
- Recompute now: POST `/api/analysis/recompute` with `{ topicId }` (mod/admin only).
- Scheduled sweep: GET `/api/analysis/scheduled` (invoked by Cloud Scheduler; can be called manually).
- Admin override: POST `/api/admin/analysis/override` with `{ topicId, category, value, note? }`.

Data Model
- Topics store analysis under `analysis.*` and flattened filters under `analysis_flat.*`.
- History: `topics/{topicId}/analysis_history/*` retains last 100 snapshots with `createdAt`, `categories`, `digestHash`, and `trigger`.

Security
- Clients cannot write `analysis.*` or `analysis_flat.*` (rules enforce). Admin server writes via Admin SDK bypass rules.

Scheduling & Debounce
- Event triggers (statement/thread creates) mark `_jobs/analysis_{topicId}` with `lastRequestedAt`.
- Scheduler hits `/api/analysis/scheduled` every 1–5 minutes:
  - Debounce: waits ≥20s after last request.
  - Under load: per-topic cooldown 30s.

Acceptance Checks
- New message updates pills within ~20–60s (depending on debounce + scheduler).
- Engagement flips Active/Dormant as threads get busy/quiet.
- Confidence < 0.65 renders “Not enough data yet”.
- Moderator override freezes a category and shows note in mod UI (value does not auto-change).

Observability
- API responses include per-category value/confidence. Use Firebase logs for errors.

Common Actions
- Force recompute for a topic: call recompute endpoint (ensure bearer token from admin/mod).
- Clear stuck jobs: delete `_jobs/analysis_{topicId}`.
- Audit: inspect `topics/{topicId}/analysis_history` for flip‑flops or drift.

Feature Flags
- Global: `FEATURE_FLAGS.aiPills` (in code). A per-topic hold can be implemented by setting an admin field and branching server-side if needed.

Notes
- No external integrations added; uses existing Admin SDK + Genkit model where already configured.

