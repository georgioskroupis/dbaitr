Version: 2026.02
Last updated: 2026-02-12
Owner: Platform Engineering
Non-negotiables:
- YouTube is transport-only; chat and moderation are first-party (`liveRooms/**`, `/api/livechat/*`)
- Protected endpoints enforce App Check + ID token via `withAuth`
- Client does not write privileged live fields (`liveDebates.youtube.*`, debate/room lifecycle)
Acceptance: Admin, host/debater, viewer, and moderator can execute this runbook and validate expected outcomes end-to-end

# Live Debate End-to-End Runbook

## Scope

This runbook validates the full live debate flow with first-party chat moderation:

- YouTube OAuth and stream lifecycle (create, ingest, transition, complete/cancel)
- Platform chat lifecycle and moderation controls
- Role-based behavior for admin, host/debater, viewer, moderator

## Current Implementation Status

Implemented:

- Global YouTube OAuth connection (`/settings/integrations/youtube`)
- Live creation and YouTube bind flow (`POST /api/live/create`)
- Ingest retrieval with RTMPS preference (`GET /api/live/[id]/ingest`)
- Preflighted transitions (`POST /api/live/[id]/transition`)
- Chat posting/moderation via first-party APIs (`/api/livechat/*`)
- Room status mirror (`liveDebates.status` -> `liveRooms.status`)

Partial / manual today:

- Moderator roster management is data-driven (`liveRooms.moderators`) and currently manual/admin-tooling based.
- There is no dedicated in-app debater invitation workflow yet; debater operations are currently host-driven.
- Poller scheduling for `/api/live/poll` is best-effort/manual unless explicitly wired by ops.

## Preconditions

1. Admin account has role `admin` or `super-admin` and status `Verified`.
2. Host account has role `supporter` (or higher) and status `Verified`.
3. Viewer account has role `viewer` and status `Grace` or `Verified`.
4. Optional moderator account exists (viewer/supporter is fine) and is added to `liveRooms/{id}.moderators`.
5. YouTube global channel is connected in `/settings/integrations/youtube`.
6. Encoder (OBS or equivalent) is available for ingest testing.

## Test 1: Admin Setup and OAuth

1. Open `/settings/integrations/youtube` as admin.
2. Connect or reconnect YouTube.
3. Expected:
   - UI shows connected state.
   - No `youtube_not_connected` errors on status check/create.
4. Negative checks:
   - Cancel OAuth once and confirm user-facing `access_denied` message appears.
   - Retry connect and confirm recovery.

## Test 2: Host/Debater Stream Lifecycle

1. Open `/live/new` as host.
2. Create debate with valid title and scheduled start time.
3. Expected:
   - New `liveDebates/{id}` contains `youtube.broadcastId`, `youtube.streamId`, `youtube.videoId`.
   - New `liveRooms/{id}` exists with `status=scheduled`.
4. Open `/live/{id}`.
5. Click `Show RTMP Ingest` and configure encoder with returned server/key.
6. Start encoder.
7. Click `Go to Testing`.
8. Expected:
   - Route returns success.
   - `liveDebates.status=testing`.
   - `liveRooms.status=scheduled`.
9. Click `Go Live`.
10. Expected:
    - `liveDebates.status=live`.
    - `liveRooms.status=live`.
    - Viewer can watch YouTube embed.
11. Click `End Stream`.
12. Expected:
    - `liveDebates.status=complete`.
    - `liveRooms.status=ended`.

## Test 3: Viewer Experience

1. Open `/live/{id}` as signed-out user and as signed-in viewer.
2. Expected:
   - Video visible when status is `live`/`complete`.
   - Chat messages readable.
   - Posting disabled for signed-out users.
3. While room is not live (`scheduled`/`ended`), verify posting is blocked (`not_live` behavior).

## Test 4: Moderator Controls

1. Ensure moderator UID is present in `liveRooms/{id}.moderators`.
2. As moderator on `/live/{id}`, execute commands in chat input:
   - `/slow 5`
   - `/pin <messageId>`
   - `/shadow <uid>`
3. Expected:
   - `settings.slowModeSec` updated.
   - `pinned` array updated.
   - `settings.bannedUids` updated.
4. Verify normal user then gets:
   - Slow mode cooldown (`slow_mode`).
   - Shadowing effect (message hidden to others, visible to sender/mod/host).

## Test 5: Policy Gates

1. Set `liveRooms/{id}.settings.supporterOnly=true`.
2. Confirm non-supporter viewer gets `supporters_only` on post.
3. Set `emojiOnly=true`.
4. Confirm non-emoji text is rejected; emoji-only text succeeds.
5. Set `questionsOnly=true`.
6. Confirm posted message is stored with type `question`.

## Test 6: Failure Injection and Recovery

1. Stop encoder and attempt `Go to Testing` or `Go Live`.
2. Expected: `stream_inactive`.
3. Try `Go Live` directly from scheduled.
4. Expected: `invalid_transition`.
5. Trigger before schedule window and attempt `Go Live`.
6. Expected: `too_early`.
7. Revoke YouTube token in provider settings and retry ingest/transition.
8. Expected: `youtube_not_connected`; reconnect resolves.

## Verification Artifacts

Collect and store:

- Debate id and URL (`/live/{id}`)
- Timestamped screenshots for each role
- Firestore snapshots:
  - `liveDebates/{id}`
  - `liveRooms/{id}`
  - `liveRooms/{id}/messages/*`
- Relevant request IDs from server logs on failures

## Troubleshooting Map

- `youtube_not_connected`: OAuth missing/expired/revoked. Reconnect as configured global channel owner.
- `live_streaming_not_enabled`: Enable Live Streaming in YouTube Studio and wait for activation.
- `live_embedding_not_allowed`: Channel policy/defaults have embedding disabled; enable embedding in YouTube Studio before creating debates.
- `stream_not_bound`: Debate broadcast and stream linkage drifted; recreate/bind again.
- `stream_inactive`: Encoder not active or wrong ingest key/server.
- `invalid_transition`: Wrong lifecycle order.
- `too_early`: Live transition attempted too far ahead of scheduled start.
- `not_live`: Chat attempted while room is not in live state.
- `supporters_only`: User does not satisfy supporter-only gate.

## Operational Notes

- Use `/api/live/poll` as admin to reconcile lifecycle drift.
- Poll response now includes `updated`, `failed`, and `failedIds` for easier triage.
- Keep all live/chat writes server-side; do not bypass API routes from client code.
