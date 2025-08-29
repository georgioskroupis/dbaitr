import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebaseAdmin';
import youtubeProvider from '@/providers/video/youtube';

export async function GET(req: Request, context: any) {
  const { params } = context as { params: { id: string } };
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !auth || !db) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const snap = await db.collection('liveDebates').doc(params.id).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const data = snap.data() as any;
    if (!(data?.createdBy === uid || (decoded as any)?.role === 'admin')) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const streamId = data?.youtube?.streamId;
    if (!streamId) return NextResponse.json({ ok: false, error: 'no_stream' }, { status: 400 });
    const ingest = await youtubeProvider.getIngest(uid, streamId);
    return NextResponse.json({ ok: true, ...ingest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
