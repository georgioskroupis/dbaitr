Version: 2026.02
Last updated: 2026-02-11
Owner: Platform Engineering
Non-negotiables:
- Client reads chat; all writes/mod actions go through server APIs
- Firestore `liveRooms/**` is client read-only in rules
- Presence uses RTDB with per-user paths and disconnect cleanup
Acceptance: Document matches current `LiveChat` component and API handlers

# Live Chat

## Overview

Live chat is rendered on `/live/[id]` via `LiveChat` and uses:

- Firestore room + messages:
  - `liveRooms/{roomId}`
  - `liveRooms/{roomId}/messages/{msgId}`
- RTDB presence:
  - `presence/{roomId}/{uid}`

Chat writes are API-only (`POST /api/livechat/post`).

If direct client Firestore reads are denied in a session (for example, deployed rules drift from repo rules), `LiveChat` automatically switches to a compatibility mode that polls server state from `GET /api/livechat/state`.

This chat system is intentionally separate from YouTube chat so moderation, policy, and telemetry are fully platform-controlled.

## Room Lifecycle

`liveRooms/{id}.status` is mirrored from live-debate lifecycle by server routes:

- `scheduled` for pre-live/testing states
- `live` when debate is live
- `ended` for complete/canceled/error

Posting is allowed only when room status is `live`.

## Roles and Posting Gates

From room data + claims:

- host: `liveRooms/{roomId}.hostUid == uid`
- mod: `liveRooms/{roomId}.moderators` contains uid
- supporter: role/claims indicate supporter subscription

Settings gates:

- `supporterOnly=true`: only host/mod/supporter can post
- `slowModeSec>0`: per-user cooldown enforced server-side
- `emojiOnly=true`: server rejects non-emoji content
- `questionsOnly=true`: server coerces message type to `question`
- `bannedUids[]`: user messages are shadowed

## Post Endpoint

`POST /api/livechat/post` body `{ roomId, text, type }`

- Protected with App Check + ID token (`withAuth`)
- Validates room exists and is live
- Enforces role/settings gates
- Enforces max length (500 chars)
- Stores message in Firestore and increments room message count
- Logs telemetry event under `_private/telemetry/events`

## Read Compatibility Endpoint

`GET /api/livechat/state?roomId=<id>&limit=<n>`

- App Check-protected public endpoint (`withAuth({ public: true })`)
- Uses Admin SDK to return room metadata and latest messages
- Used only when client Firestore listeners fail with `permission-denied`

## Moderation Endpoints

- `POST /api/livechat/mod/slow` -> set slow mode seconds
- `POST /api/livechat/mod/shadow` -> shadow/unshadow uid
- `POST /api/livechat/mod/pin` -> pin/unpin message id

All require host/mod privileges for that room.

## Presence

Client writes own RTDB presence node and registers disconnect removal:

- `set(presence/{roomId}/{uid}, { typing:false, ... })`
- `onDisconnect(...).remove()`
- `typing` toggled via updates as user types

This prevents stale watcher counts across tab closes/disconnects.

## Firestore Rules Expectations

Implemented in `firestore.rules`:

- `liveRooms/{roomId}` read/list allowed, writes denied
- `liveRooms/{roomId}/messages/{msgId}` read/list allowed, writes denied
- `liveRooms/{roomId}/userState/{uid}` read own only, writes denied

All writes are performed by server APIs using Admin SDK.
