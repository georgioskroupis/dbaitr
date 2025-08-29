Live Chat integration for dbaitr

Overview
- A reusable LiveChat panel renders beneath the YouTube Live player on the live debate page.
- Reads from Firestore at `liveRooms/{roomId}` and `liveRooms/{roomId}/messages/*`.
- Presence and typing indicators use RTDB at `presence/{roomId}/{uid}`.
- Posting is centralized through a server endpoint (`POST /api/livechat/post`) to enforce roles, supporter-only, slow-mode, and basic moderation. The client never writes messages directly.

Roles & Gating
- host: `liveRooms/{roomId}.hostUid`
- mod: `liveRooms/{roomId}.moderators[]`
- supporter: Firebase custom claim `supporter: true` or `subscription in {plus,supporter,core}` from Stripe webhook.
- viewer: fallback.
- supporterOnly: When `liveRooms/{roomId}.settings.supporterOnly = true`, only host/mod/supporter can post; everyone can read.

Server endpoint
- `POST /api/livechat/post` accepts JSON `{ roomId, text, type }` and requires an ID token. App Check is enforced.
- Checks:
  - room exists and is `status=live`.
  - host/mod/supporter gating when `supporterOnly`.
  - slow-mode via `liveRooms/{roomId}/userState/{uid}.lastPostAt` vs `settings.slowModeSec`.
  - basic moderation (profanity/URL heuristic) marks a message `shadowed=true` (not blocked; only hidden from non-mod/host).
  - Writes message to `liveRooms/{roomId}/messages` with `createdAt` and increments `stats.messageCount`.

Client component
- `src/components/live/LiveChat.tsx`:
  - Props: `roomId`.
  - Subscribes to `liveRooms/{roomId}` and last 50 messages ordered by `createdAt`.
  - Hides `shadowed` messages for non-host/mod, except shows to the author.
  - Composer respects `supporterOnly`, `emojiOnly`, `questionsOnly` in room settings (UI), while server enforces the final policy.
  - Presence: counts watchers and shows typing indicators via RTDB.

Rules (to apply separately)
Firestore
```
match /databases/{db}/documents {
  match /liveRooms/{roomId} {
    allow read: if true;
    allow write: if false; // settings and pins updated via privileged server endpoints only
    match /messages/{msgId} {
      allow read: if true;
      allow create, update, delete: if false; // posting via server endpoint only
    }
    match /userState/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false; // written by server endpoint only
    }
  }
}
```

RTDB
```
{
  "rules": {
    ".read": true,
    "presence": {
      "$roomId": {
        "$uid": {
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    }
  }
}
```

Embedding
- The live debate page (`/live/[roomId]`) imports and renders `LiveChat` under the YouTube player:
  - `import { LiveChat } from '@/components/live/LiveChat'`
  - `<LiveChat roomId={params.id} />`

Environment & App Check
- Uses the existing production Firebase project configuration and App Check. In dev, use the debug token flow already implemented in the app.

Analytics
- The server endpoint logs anonymized event metadata in Firestore under `_private/telemetry/events` with `kind='livechat_post'` (no message content stored).

Operations
- Slow-mode: toggle `liveRooms/{roomId}.settings.slowModeSec` (seconds). The server enforces and the client shows a general disabled state; a retry-after is returned on hit.
- Supporter-only: set `liveRooms/{roomId}.settings.supporterOnly=true`.
- Shadow-ban & moderation tools: implement as privileged endpoints to flip `shadowed` on messages or maintain a banlist, and update UI via existing mod tools.
