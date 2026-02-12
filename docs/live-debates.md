Version: 2026.02
Last updated: 2026-02-11
Owner: Platform Engineering
Non-negotiables:
- All YouTube API calls are server-side behind withAuth where applicable
- Global channel OAuth tokens are server-only under `_private/youtubeTokens/global/host`
- Server-only writes for `liveDebates.youtube.*`, `liveDebates.status`, and live room lifecycle state
Acceptance: Document reflects current routes, provider behavior, and status mapping

# Live Debates (YouTube)

This document describes the current production YouTube live-debate flow.

YouTube is used for video transport only. Chat and moderation are first-party (`liveRooms/**` + `/api/livechat/*`) and do not use YouTube live chat APIs.

## Environment Variables

Required:

- `VIDEO_PROVIDER=youtube`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI` (e.g. `https://<app>/api/integrations/youtube/oauth/callback`)
- `YOUTUBE_CHANNEL_ID` (global channel id)
- `YOUTUBE_CHANNEL_USER_ID` (derived from channel id for strict global-owner matching)

Also ensure standard Firebase client/admin env is configured.

## Data Model

- `liveDebates/{id}`:
  - public debate metadata and lifecycle status
  - server-only `youtube.*` fields (broadcast/stream ids, ingest details)
- `liveRooms/{id}`:
  - chat room metadata and lifecycle mirror used by live chat UI/APIs
- `_private/youtubeTokens/global/host`:
  - global channel OAuth refresh/access token material (server-only)

## OAuth (Global Channel)

1. Admin starts OAuth via `POST /api/integrations/youtube/oauth/start`.
2. State + PKCE verifier stored in `_private/youtubeOAuthStates/pending/{state}`.
3. Callback `GET /api/integrations/youtube/oauth/callback` exchanges code and stores tokens under `_private/youtubeTokens/global/host`.

Global mode is strict: connected channel/user must match `YOUTUBE_CHANNEL_ID`/`YOUTUBE_CHANNEL_USER_ID`.

## Create Flow

`POST /api/live/create`

- AuthZ: supporter+ role and `Verified` status.
- Creates YouTube broadcast + stream, binds stream to broadcast.
- Broadcasts are created with embedding enabled (`contentDetails.enableEmbed=true`) and then re-verified with YouTube before returning success.
- If YouTube/channel policy still reports embedding disabled, create fails with `live_embedding_not_allowed` (hosts must not create non-embeddable debates).
- Persists Firestore in one commit:
  - `liveDebates/{id}` with status `scheduled` and `youtube.*`
  - `liveRooms/{id}` with status `scheduled`
- Returns debate id, watch URL, and embed URL.

Note: create now requires `scheduledStartTime`.

## Ingest Flow

`GET /api/live/[id]/ingest`

- AuthZ: owner or admin/super-admin.
- Fast path: returns stored ingest values when present.
- Otherwise fetches ingest from YouTube provider.
- Provider prefers secure RTMPS ingest address when available.

## Transition Flow

`POST /api/live/[id]/transition` body `{ to: testing|live|complete }`

- AuthZ: owner or admin/super-admin.
- Preflight checks:
  - global creds connected
  - broadcast is bound to expected stream
  - stream status is `active` before `testing`/`live`
  - `live` not before schedule window (`too_early`)
  - transition order validation
- Executes YouTube transition.
- Persists both:
  - `liveDebates.status`
  - mirrored `liveRooms.status` (`scheduled|live|ended`)

## Poller

`POST /api/live/poll`

- Admin-only.
- Reconciles active live debates with YouTube lifecycle.
- Updates both `liveDebates.status` and mirrored `liveRooms.status`.

## Cancel

`POST /api/live/[id]/cancel`

- AuthZ: owner or admin/super-admin.
- Best-effort YouTube revoke transition.
- Sets `liveDebates.status='canceled'` and `liveRooms.status='ended'`.

## Error Semantics

Use stable app codes from `docs/error-catalog.md`:

- Create:
  - `youtube_not_connected`
  - `live_streaming_not_enabled`
  - `live_embedding_not_allowed`
- Ingest:
  - `not_found`, `forbidden`, `no_stream`, `stream_not_found`, `youtube_not_connected`, `no_ingestion_info`
- Transition:
  - `invalid_transition`, `stream_not_bound`, `stream_inactive`, `too_early`, `youtube_not_connected`, `live_streaming_not_enabled`

## Security Notes

- App Check + ID token are enforced for protected endpoints via `withAuth`.
- Stream key is only returned via owner/admin server endpoint.
- `_private/**` remains client-inaccessible by rules.
- Client cannot write privileged live metadata (`youtube.*`, `status`).

Operational validation checklist: `docs/ops/live-debate-e2e-runbook.md`.
