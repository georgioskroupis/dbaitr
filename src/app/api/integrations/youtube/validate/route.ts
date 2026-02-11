export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';
import { resolveGlobalYoutubeCreds } from '@/providers/video/youtubeCreds';
import { saveAccessToken, markInvalid, setLastValidateOkAt } from '@/providers/video/tokenManager';

export const GET = withAuth(async (_req, _ctx) => {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  try {
    const creds = await resolveGlobalYoutubeCreds();
    if (!creds.hasRefresh) {
      return NextResponse.json({ ok: false, error: 'youtube_not_connected' }, { status: 409 });
    }
    const { google } = await import('googleapis');
    const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID!;
    const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET!;
    const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI!;
    const o = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    // Load refresh token and attempt a light auth call
    const { getDbAdmin } = await import('@/lib/firebase/admin');
    const db = getDbAdmin();
    const ref = db.collection('_private').doc('youtubeTokens').collection('global').doc('host');
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as any) : null;
    const refreshToken = data?.refreshToken || null;
    if (!refreshToken) {
      return NextResponse.json({ ok: false, error: 'youtube_not_connected' }, { status: 409 });
    }
    o.setCredentials({ refresh_token: refreshToken });
    (o as any).on('tokens', (t: any) => {
      if (t?.access_token) saveAccessToken({ accessToken: t.access_token, expiryDate: typeof t.expiry_date === 'number' ? t.expiry_date : undefined });
    });
    const yt = google.youtube({ version: 'v3', auth: o });
    try {
      const res = await yt.channels.list({ part: ['snippet'], mine: true });
      const ch = res.data.items?.[0];
      if (!ch) return NextResponse.json({ ok: false, error: 'youtube_not_connected' }, { status: 409 });
      const channelId = ch.id || null;
      const channelTitle = ch.snippet?.title || null;
      try { await setLastValidateOkAt(); } catch {}
      return NextResponse.json({ ok: true, channelId, channelTitle });
    } catch (e: any) {
      const httpStatus = e?.response?.status || e?.status;
      const reason = e?.errors?.[0]?.reason || e?.response?.data?.error?.errors?.[0]?.reason || e?.response?.data?.error?.status || '';
      if (httpStatus === 401 || /invalid_grant/i.test(String(reason))) {
        try { await markInvalid(); } catch {}
        if (process.env.NODE_ENV !== 'production') { try { console.error(JSON.stringify({ action: 'yt.validate', result: 'unauthorized' })); } catch {} }
        return NextResponse.json({ ok: false, error: 'youtube_not_connected' }, { status: 409 });
      }
      if (httpStatus === 403 || /insufficientPermissions/i.test(String(reason))) {
        return NextResponse.json({ ok: false, error: 'youtube_not_connected' }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });

