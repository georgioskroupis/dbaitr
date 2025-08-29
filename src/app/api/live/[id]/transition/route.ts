export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebaseAdmin';
import youtubeProvider from '@/providers/video/youtube';

const Schema = z.object({ to: z.enum(['testing', 'live', 'complete']) });

export async function POST(req: Request, context: any) {
  const { params } = context as { params: { id: string } };
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !auth || !db) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const body = Schema.parse(await req.json());
    const ref = db.collection('liveDebates').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const d = snap.data() as any;
    if (!(d?.createdBy === uid || (decoded as any)?.role === 'admin')) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const broadcastId = d?.youtube?.broadcastId;
    if (!broadcastId) return NextResponse.json({ ok: false, error: 'no_broadcast' }, { status: 400 });
    await youtubeProvider.transition(uid, broadcastId, body.to);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
