export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import youtubeProvider from '@/providers/video/youtube';

export const GET = withAuth(async (ctx, _req, context: any) => {
  const { params } = context as { params: { id: string } };
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const snap = await db.collection('liveDebates').doc(params.id).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const data = snap.data() as any;
    if (!(data?.createdBy === uid || (ctx?.role === 'admin'))) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const streamId = data?.youtube?.streamId;
    if (!streamId) return NextResponse.json({ ok: false, error: 'no_stream' }, { status: 400 });
    const ingest = await youtubeProvider.getIngest(uid, streamId);
    return NextResponse.json({ ok: true, ...ingest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Verified']) });
