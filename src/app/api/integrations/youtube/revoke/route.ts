import { NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebaseAdmin';
import youtubeProvider from '@/providers/video/youtube';

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const role = (decoded as any)?.role || 'viewer';
    if (process.env.YOUTUBE_CHANNEL_ID && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    await youtubeProvider.revoke(decoded.uid);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
