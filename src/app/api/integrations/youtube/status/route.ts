export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';

export const GET = withAuth(async (req, ctx: any) => {
  try {
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const envChannel = process.env.YOUTUBE_CHANNEL_ID || null;
    const envUser = process.env.YOUTUBE_CHANNEL_USER_ID || null;

    if (envChannel) {
      // Global mode: no auth required to return minimal connection state
      const ref = db.collection('_private').doc('youtubeTokens').collection('global').doc('host');
      const snap = await ref.get();
      const data = snap.exists ? (snap.data() as any) : null;
      const haveToken = !!data?.refreshToken;
      const channelOk = haveToken && data?.channelId === envChannel;
      const userOk = haveToken && data?.userId && envUser ? (data.userId === envUser) : true;
      const connected = !!(haveToken && channelOk && userOk);
      const mismatch = haveToken && (!channelOk || !userOk);
      const status = !haveToken ? 'not_connected' : (mismatch ? 'mismatch' : (data?.status || 'ok'));
      return NextResponse.json({ ok: true, global: true, connected, mismatch, channelId: data?.channelId || null, userId: data?.userId || null, channelTitle: data?.channelTitle || null, hasRefresh: haveToken, status, required: { channelId: envChannel, userId: envUser } });
    }

    // Global-only enforced. If env missing, report not configured.
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { public: true });
