# Live Debates (YouTube) — Setup & Notes

This document outlines how to enable YouTube Live integration for dbaitr.

## Environment Variables

- `VIDEO_PROVIDER=youtube`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI` — e.g., `https://your.app/api/integrations/youtube/oauth/callback`

Also ensure existing Firebase env vars are set for the app. For local dev, App Check debug token is enabled automatically.

## Google Cloud / YouTube Setup

1. Enable the YouTube Data API v3 in your Google Cloud project.
2. Create OAuth 2.0 credentials:
   - Application type: Web
   - Authorized redirect URI: `${YOUTUBE_REDIRECT_URI}`
3. Copy Client ID/Secret into env vars.
4. In YouTube Studio, ensure Live streaming eligibility is enabled for the channel(s).

## Firestore

Collections created by this feature:

- `liveDebates/{id}`: public info about scheduled/live/past lives.
- `_private/youtubeTokens/byUser/{uid}`: server-only token storage.

Security rules ensure only hosts/admin can create/update/delete liveDebates and only server can write `youtube.*` and `status` fields.

## OAuth Flow

- Host visits `/settings/integrations/youtube` and requests a connect URL (server generates one).
- After granting access, the server exchanges the code for tokens, stores refresh token, and saves channel info.

## Hosting Flow

- Host visits `/live/new`, fills in title/description/visibility.
- Server creates YouTube broadcast + stream, binds them, and stores ingest details server-side.
- Host can fetch RTMP ingest + key from `/api/live/:id/ingest` (host-only).
- Host transitions broadcast from testing → live → complete via `/api/live/:id/transition`.

## Player

- Embedded via YouTube no-cookie iframe on `/live/[id]` when live/complete.

## Poller

- `/api/live/poll` can be triggered to refresh statuses from YouTube.

## Security Notes

- Stream key is only ever returned to the owner (or admin) via a host-only API.
- `_private` collection disallows client access entirely.
- App Check enforced on client; dev uses debug token; production uses ReCAPTCHA.

## Future Providers

- Abstraction in `src/providers/video` allows swapping to Livepeer/Mux/Cloudflare later.
