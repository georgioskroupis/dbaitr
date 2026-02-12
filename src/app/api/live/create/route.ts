export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';
import { youtubeProvider } from '@/providers/video/youtube';
import type { Visibility } from '@/providers/video';

const Schema = z.object({
  title: z.string().min(3),
  description: z.string().max(5000).optional(),
  scheduledStartTime: z.string().datetime(),
  visibility: z.enum(['public', 'unlisted', 'private']).default('unlisted'),
  flags: z.object({
    allowDvr: z.boolean().optional(),
    ultraLowLatency: z.boolean().optional(),
    autoStart: z.boolean().optional(),
    autoStop: z.boolean().optional(),
  }).optional(),
});

export const POST = withAuth(async (req, ctx: any) => {
  const uid = ctx?.uid as string;
  let createdBroadcastId: string | null = null;
  try {
    const db = getDbAdmin();
    const body = await req.json();
    const input = Schema.parse(body);
    const scheduledStart = new Date(input.scheduledStartTime);
    const docRef = db.collection('liveDebates').doc();

    // Create YouTube entities first to avoid orphan debate docs when provider calls fail.
    const b = await youtubeProvider.createBroadcast(uid, {
      title: input.title,
      description: input.description,
      scheduledStartTime: scheduledStart,
      visibility: input.visibility as Visibility,
      allowDvr: input.flags?.allowDvr ?? true,
      ultraLowLatency: input.flags?.ultraLowLatency ?? true,
      ...(typeof input.flags?.autoStart === 'boolean' ? { autoStart: input.flags.autoStart } : {}),
      ...(typeof input.flags?.autoStop === 'boolean' ? { autoStop: input.flags.autoStop } : {}),
    });
    createdBroadcastId = b.broadcastId;
    const s = await youtubeProvider.createStream(uid, { title: input.title });
    await youtubeProvider.bind(uid, b.broadcastId, s.streamId);

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(
      docRef,
      {
        title: input.title,
        description: input.description || '',
        createdBy: uid,
        createdAt: now,
        scheduledStartTime: scheduledStart,
        scheduledEndTime: null,
        status: 'scheduled',
        visibility: input.visibility as Visibility,
        host: { uid, youtubeChannelId: null, youtubeChannelTitle: null },
        metrics: { viewerCountPeak: null, viewerCountAvg: null },
        flags: {
          allowDvr: input.flags?.allowDvr ?? true,
          ultraLowLatency: input.flags?.ultraLowLatency ?? true,
          autoStart: input.flags?.autoStart ?? false,
          autoStop: input.flags?.autoStop ?? true,
        },
        youtube: {
          broadcastId: b.broadcastId,
          streamId: s.streamId,
          videoId: b.videoId,
          ingestAddress: s.ingestAddress,
          streamName: s.streamName,
        },
      },
      { merge: true },
    );

    // Mirror chat room state to a dedicated liveRooms namespace consumed by LiveChat.
    batch.set(
      db.collection('liveRooms').doc(docRef.id),
      {
        title: input.title,
        hostUid: uid,
        moderators: [],
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
        settings: {
          supporterOnly: false,
          slowModeSec: 0,
          emojiOnly: false,
          questionsOnly: false,
          bannedUids: [],
        },
        pinned: [],
        stats: { messageCount: 0 },
      },
      { merge: true },
    );
    await batch.commit();

    const watchUrl = `https://www.youtube.com/watch?v=${b.videoId}`;
    const embedUrl = `https://www.youtube-nocookie.com/embed/${b.videoId}?autoplay=0&modestbranding=1&rel=0&playsinline=1`;
    return NextResponse.json({ ok: true, debateId: docRef.id, videoId: b.videoId, watchUrl, embedUrl });
  } catch (e: any) {
    // Best-effort cleanup when a broadcast was created but subsequent setup failed.
    if (createdBroadcastId) {
      try { await youtubeProvider.transition(uid, createdBroadcastId, 'canceled'); } catch {}
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'bad_request', issues: e.issues }, { status: 400 });
    }
    const msg = (e?.message || '').toString();
    if (msg === 'youtube_not_connected' || /invalid_grant/i.test(msg)) {
      return NextResponse.json({ ok: false, error: 'youtube_not_connected', message: 'YouTube is not connected. An admin must connect the configured channel in Settings → Integrations → YouTube.' }, { status: 409 });
    }
    if (msg === 'youtube_not_connected_global_mismatch') {
      return NextResponse.json({ ok: false, error: 'youtube_not_connected', message: 'Connected account/channel does not match YOUTUBE_CHANNEL_ID/YOUTUBE_CHANNEL_USER_ID. Reconnect as the configured channel owner.' }, { status: 409 });
    }
    if (msg === 'live_streaming_not_enabled') {
      return NextResponse.json({ ok: false, error: 'live_streaming_not_enabled', message: 'Live streaming is not enabled for the configured YouTube channel. In YouTube Studio, enable Live Streaming under Settings → Channel → Feature eligibility (or Live → Enable), then wait up to 24 hours for activation.' }, { status: 409 });
    }
    if (msg === 'live_embedding_not_allowed') {
      return NextResponse.json({
        ok: false,
        error: 'live_embedding_not_allowed',
        message: 'YouTube broadcast embedding is disabled by channel policy/defaults. Enable embedding in YouTube Studio for this channel before creating live debates.',
      }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'server_error', message: msg }, { status: 500 });
  }
}, { ...requireRole('supporter'), ...requireStatus(['Verified']) });
