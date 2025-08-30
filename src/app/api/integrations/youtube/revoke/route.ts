export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import youtubeProvider from '@/providers/video/youtube';

export const POST = withAuth(async (ctx, _req) => {
  try {
    const role = ctx?.role || 'viewer';
    if (process.env.YOUTUBE_CHANNEL_ID && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    await youtubeProvider.revoke(ctx?.uid as string);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
