export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import youtubeProvider from '@/providers/video/youtube';
import { resolveGlobalYoutubeCreds } from '@/providers/video/youtubeCreds';
import { purgeYoutubeCredentials } from '@/providers/video/youtube';

const Schema = z.object({ to: z.enum(['testing', 'live', 'complete']) });

export const POST = withAuth(async (req, ctx: any) => {
  const id = (ctx?.params as any)?.id;
  const params = { id } as { id: string };
  const rid = Math.random().toString(36).slice(2);
  try { if (process.env.NODE_ENV !== 'production') console.error('[transition] handler entry', { requestId: rid }); } catch {}
  if (!id) return NextResponse.json({ ok: false, error: 'not_found', requestId: rid }, { status: 404 });
  try {
    // Structured trace: transition start
    try {
      console.log(JSON.stringify({ level: 'info', route: `/api/live/${params.id}/transition`, action: 'start', uid: ctx?.uid || null, role: ctx?.role || null, statusClaim: ctx?.status || null }));
    } catch {}
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const body = Schema.parse(await req.json());
    try { console.log(JSON.stringify({ level: 'info', route: `/api/live/${params.id}/transition`, action: 'parsed_body', to: body?.to })); } catch {}
    const ref = db.collection('liveDebates').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const d = snap.data() as any;
    try { console.log(JSON.stringify({ level: 'info', route: `/api/live/${params.id}/transition`, action: 'loaded_doc', status: d?.status || null, createdBy: d?.createdBy || null, youtube: { broadcastId: d?.youtube?.broadcastId || null, streamId: d?.youtube?.streamId || null } })); } catch {}
    if (!(d?.createdBy === (ctx?.uid as string) || (ctx?.role === 'admin'))) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const broadcastId = d?.youtube?.broadcastId;
    if (!broadcastId) return NextResponse.json({ ok: false, error: 'no_broadcast' }, { status: 400 });

    // Resolve global YouTube credentials before any provider calls
    try {
      const creds = await resolveGlobalYoutubeCreds();
      if (process.env.NODE_ENV !== 'production') {
        try { console.error(JSON.stringify({ action: 'yt.resolve', route: 'transition', docPath: creds.docPath, hasRefresh: creds.hasRefresh, channelId: creds.channelId || null, requiredChannelId: creds.requiredChannelId || null, requestId: rid })); } catch {}
      }
      if (!creds.hasRefresh) {
        return NextResponse.json({ ok: false, error: 'youtube_not_connected' }, { status: 409 });
      }
    } catch {}

    // Preflight (read-only) — capture state and enforce expected preconditions
    const streamId = d?.youtube?.streamId || null;
    let bf: { lifecycle: string | null; boundStreamId: string | null; scheduledStartTime: string | null } = { lifecycle: null, boundStreamId: null, scheduledStartTime: null };
    let sf: { streamStatus: string | null; healthStatus: string | null } = { streamStatus: null, healthStatus: null };
    try {
      bf = await youtubeProvider.getBroadcastInfo(uid, broadcastId);
      sf = streamId ? await youtubeProvider.getStreamInfo(uid, streamId) : { streamStatus: null, healthStatus: null };
    } catch (e: any) {
      const httpStatus = e?.response?.status || e?.status;
      const reason = e?.errors?.[0]?.reason || e?.response?.data?.error?.errors?.[0]?.reason || e?.response?.data?.error?.status || '';
      try { console.warn(JSON.stringify({ level: 'warn', route: `/api/live/${params.id}/transition`, action: 'preflight.error', message: (e?.message || '').toString(), httpStatus, reason })); } catch {}
      if (httpStatus === 401 || httpStatus === 403 || /invalid_grant/i.test(String(reason))) {
        try { await purgeYoutubeCredentials(uid); } catch {}
        if (process.env.NODE_ENV !== 'production') { try { console.error(JSON.stringify({ action: 'yt.refresh.fail', reason: 'invalid_grant', requestId: rid })); } catch {} }
        return NextResponse.json({ ok: false, error: 'youtube_not_connected' }, { status: 409 });
      }
    }
    const matchesDocStream = !!(bf.boundStreamId && streamId && bf.boundStreamId === streamId);
    const docSched = (d?.scheduledStartTime?.toMillis?.() ? new Date(d.scheduledStartTime.toMillis()) : (d?.scheduledStartTime ? new Date(d.scheduledStartTime) : null)) as Date | null;
    const now = new Date();
    const tooEarly = !!(docSched && docSched.getTime() - now.getTime() > 2 * 60 * 1000);
    try {
      console.log(JSON.stringify({
        level: 'info', route: `/api/live/${params.id}/transition`, action: 'preflight',
        to: body?.to || null,
        broadcast: { lifecycle: bf.lifecycle, boundStreamId: bf.boundStreamId, scheduledStartTime: bf.scheduledStartTime },
        stream: { id: streamId, status: sf.streamStatus, health: sf.healthStatus },
        matchesDocStream,
        doc: { status: d?.status || null, scheduledStartTime: (docSched ? docSched.toISOString() : null) },
      }));
    } catch {}

    // Enforce preflight rules before calling YouTube
    if (!matchesDocStream) {
      return NextResponse.json({ ok: false, error: 'stream_not_bound' }, { status: 409 });
    }
    if ((body.to === 'testing' || body.to === 'live') && tooEarly) {
      return NextResponse.json({ ok: false, error: 'too_early' }, { status: 409 });
    }
    // Require ACTIVE encoder before going live
    if (body.to === 'live' && (sf.streamStatus || '').toLowerCase() !== 'active') {
      return NextResponse.json({ ok: false, error: 'stream_inactive' }, { status: 409 });
    }
    // Basic order enforcement based on our doc status
    const cur = (d?.status || 'scheduled') as string;
    if (body.to === 'live' && cur !== 'testing') {
      return NextResponse.json({ ok: false, error: 'invalid_transition' }, { status: 400 });
    }
    if (body.to === 'complete' && cur !== 'live' && cur !== 'testing') {
      return NextResponse.json({ ok: false, error: 'invalid_transition' }, { status: 400 });
    }
    try { console.log(JSON.stringify({ level: 'info', route: `/api/live/${params.id}/transition`, action: 'yt.transition.call', to: body.to, broadcastId })); } catch {}
    await youtubeProvider.transition(uid, broadcastId, body.to);
    try { console.log(JSON.stringify({ level: 'info', route: `/api/live/${params.id}/transition`, action: 'yt.transition.ok', to: body.to })); } catch {}
    // Persist status to Firestore for UI
    await ref.set({ status: body.to, statusUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    try { console.log(JSON.stringify({ level: 'info', route: `/api/live/${params.id}/transition`, action: 'status.persisted', status: body.to })); } catch {}
    return NextResponse.json({ ok: true, status: body.to });
  } catch (e: any) {
    const msg = (e?.message || '').toString();
    const reason = e?.errors?.[0]?.reason || e?.response?.data?.error?.errors?.[0]?.reason || e?.response?.data?.error?.status || '';
    const httpStatus = e?.response?.status;
    try {
      console.error(JSON.stringify({
        level: 'error', route: `/api/live/${params.id}/transition`, action: 'exception',
        message: msg, reason, httpStatus,
        providerError: e?.response?.data?.error || null,
      }));
    } catch {}
    if (msg === 'youtube_not_connected_global_mismatch') {
      return NextResponse.json({ ok: false, error: 'youtube_not_connected_global_mismatch' }, { status: 409 });
    }
    if (msg === 'youtube_not_connected' || httpStatus === 401 || httpStatus === 403) {
      try { await purgeYoutubeCredentials(ctx?.uid as string); } catch {}
      if (process.env.NODE_ENV !== 'production') { try { console.error(JSON.stringify({ action: 'yt.refresh.fail', reason: 'invalid_grant', requestId: rid })); } catch {} }
      return NextResponse.json({ ok: false, error: 'youtube_not_connected' }, { status: 409 });
    }
    if (msg === 'live_streaming_not_enabled' || reason === 'liveStreamingNotEnabled') {
      return NextResponse.json({ ok: false, error: 'live_streaming_not_enabled' }, { status: 409 });
    }
    if (
      msg === 'invalid_transition' ||
      reason === 'invalidTransition' ||
      reason === 'failedPrecondition' ||
      reason === 'FAILED_PRECONDITION' ||
      msg.toLowerCase().includes('invalid transition')
    ) {
      return NextResponse.json({ ok: false, error: 'invalid_transition' }, { status: 400 });
    }
    if (msg === 'stream_not_bound' || msg.includes('stream not bound')) {
      return NextResponse.json({ ok: false, error: 'stream_not_bound' }, { status: 409 });
    }
    // Surface unexpected provider errors but avoid leaking sensitive details
    return NextResponse.json({ ok: false, error: 'server_error', message: msg || 'unknown_error' }, { status: 500 });
  }
}, { ...requireStatus(['Verified']) });
