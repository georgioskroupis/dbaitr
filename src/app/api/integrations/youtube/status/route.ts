import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const envChannel = process.env.YOUTUBE_CHANNEL_ID || null;

    if (envChannel) {
      // Global mode: no auth required to return minimal connection state
      const ref = db.collection('_private').doc('youtubeTokens').collection('global').doc('host');
      const snap = await ref.get();
      const data = snap.exists ? (snap.data() as any) : null;
      const connected = !!data?.refreshToken && data?.channelId === envChannel;
      return NextResponse.json({ ok: true, global: true, connected, channelId: connected ? data.channelId : envChannel, channelTitle: connected ? data.channelTitle || null : null });
    }

    // Per-user mode: require auth to read caller's connection
    const auth = getAuthAdmin();
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !auth) return NextResponse.json({ ok: true, global: false, connected: false });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const ref = db.collection('_private').doc('youtubeTokens').collection('byUser').doc(uid);
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as any) : null;
    const connected = !!data?.refreshToken && !!data?.channelId;
    return NextResponse.json({ ok: true, global: false, connected, channelId: connected ? data.channelId : null, channelTitle: connected ? data.channelTitle || null : null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}

