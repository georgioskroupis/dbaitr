import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/withAuth';

export const GET = withAuth(async () => {
  try {
    const channelId = process.env.YOUTUBE_CHANNEL_ID || null;
    return NextResponse.json({ ok: true, global: !!channelId, channelId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { public: true });
