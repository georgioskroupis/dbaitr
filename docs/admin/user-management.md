Admin → User Management (MVP)

Decisions
- Roles: Added `super-admin` (stricter than existing policy). Admin UI gated to `admin|super-admin`. Sensitive writes (role change, KYC override, hard delete) require `super-admin`.
- Search strategy: Server-side exact match for email/uid; filterable/sortable queries on indexed fields; fuzzy name as client-side contains on returned page (MVP, no new search infra).
- Pagination: Offset-based in API (acceptable for small admin pages). Documented for MVP; can upgrade to cursor-based.
- Auditing: All admin mutations write to `users/{uid}/audit_logs/{autoId}` with `{ by, action, reason, from, to, at }`.
- Status model: `status ∈ {verified, grace, suspended, banned, deleted}` stored on `users/{uid}`. Admin actions update `status` and timestamps.

Endpoints
- POST `/api/admin/users/list`: body `{ q, filters, sortBy, sortDir, page, pageSize }`, returns `{ items, total }`.
- GET `/api/admin/users/get/{uid}`: returns profile + activity + flags + notes + security meta.
- POST `/api/admin/users/action/{uid}`: body `{ action, reason, ... }`.
  - Actions: `suspend|ban|reinstate|changeRole|forceSignOut|forcePasswordReset|invalidateSessions|kycOverride`.
  - Auth: `admin|super-admin`; `changeRole|kycOverride` require `super-admin`.

Indexes
- Added suggested composites: `(role,status,createdAt desc)`, `(status,lastActiveAt desc)`, `(kycVerified,status,createdAt desc)`, `(provider,createdAt desc)`.

UI
- Page `/admin/users`: table list (search/filters/sort/pagination) + right-side drawer with tabs (Overview, Activity, Security, Flags, Notes).
- Bulk selection present (ergonomics); bulk actions disabled per MVP.

Security
- Firestore Rules: allow admins to read other users; writes continue server-only via Admin SDK. Owners can edit only `fullName|photoURL|updatedAt`.
- Rate limiting: future improvement (out of MVP scope) — APIs are admin-only and log every action.

