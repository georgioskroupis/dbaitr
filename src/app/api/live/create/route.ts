import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthAdmin, getDbAdmin, FieldValue } from '@/lib/firebaseAdmin';
import { youtubeProvider } from '@/providers/video/youtube';
import type { Visibility } from '@/providers/video';

const Schema = z.object({
  title: z.string().min(3),
  description: z.string().max(5000).optional(),
  scheduledStartTime: z.string().datetime().optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).default('unlisted'),
  flags: z.object({
    allowDvr: z.boolean().optional(),
    ultraLowLatency: z.boolean().optional(),
    autoStart: z.boolean().optional(),
    autoStop: z.boolean().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const claims = decoded as any;
    const role = claims?.role || 'viewer';
    const subscription = claims?.subscription;
    const eligible = process.env.NODE_ENV !== 'production' || role === 'admin' || role === 'supporter' || subscription === 'plus' || subscription === 'supporter' || subscription === 'core';
    if (!eligible) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const uid = decoded.uid;
    const body = await req.json();
    const input = Schema.parse(body);

    // Seed Firestore doc (client-writable fields only)
    const docRef = db.collection('liveDebates').doc();
    const now = FieldValue.serverTimestamp();
    await docRef.set({
      title: input.title,
      description: input.description || '',
      createdBy: uid,
      createdAt: now,
      scheduledStartTime: input.scheduledStartTime ? new Date(input.scheduledStartTime) : null,
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
    }, { merge: true });

    // Create YouTube entities (server-only fields)
    const b = await youtubeProvider.createBroadcast(uid, {
      title: input.title,
      description: input.description,
      scheduledStartTime: input.scheduledStartTime ? new Date(input.scheduledStartTime) : undefined,
      visibility: input.visibility as Visibility,
      allowDvr: input.flags?.allowDvr ?? true,
      ultraLowLatency: input.flags?.ultraLowLatency ?? true,
      autoStart: input.flags?.autoStart ?? false,
      autoStop: input.flags?.autoStop ?? true,
    });
    const s = await youtubeProvider.createStream(uid, { title: input.title });
    await youtubeProvider.bind(uid, b.broadcastId, s.streamId);

    await docRef.set({
      youtube: {
        broadcastId: b.broadcastId,
        streamId: s.streamId,
        videoId: b.videoId,
        ingestAddress: s.ingestAddress,
        streamName: s.streamName,
        liveChatId: null,
      }
    }, { merge: true });

    const watchUrl = `https://www.youtube.com/watch?v=${b.videoId}`;
    const embedUrl = `https://www.youtube-nocookie.com/embed/${b.videoId}?autoplay=0&modestbranding=1&rel=0&playsinline=1`;
    return NextResponse.json({ ok: true, debateId: docRef.id, videoId: b.videoId, watchUrl, embedUrl });
  } catch (e: any) {
    const msg = (e?.message || '').toString();
    if (msg === 'youtube_not_connected') {
      return NextResponse.json({ ok: false, error: 'youtube_not_connected', message: 'YouTube is not connected. An admin must connect the configured channel in Settings → Integrations → YouTube.' }, { status: 409 });
    }
    if (msg === 'channel_mismatch') {
      return NextResponse.json({ ok: false, error: 'channel_mismatch', message: 'Connected channel does not match YOUTUBE_CHANNEL_ID. Reconnect using the correct channel.' }, { status: 409 });
    }
    if (msg === 'live_streaming_not_enabled') {
      return NextResponse.json({ ok: false, error: 'live_streaming_not_enabled', message: 'Live streaming is not enabled for the configured YouTube channel. In YouTube Studio, enable Live Streaming under Settings → Channel → Feature eligibility (or Live → Enable), then wait up to 24 hours for activation.' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'server_error', message: msg }, { status: 500 });
  }
}
