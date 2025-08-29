import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const channelId = process.env.YOUTUBE_CHANNEL_ID || null;
    return NextResponse.json({ ok: true, global: !!channelId, channelId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}

