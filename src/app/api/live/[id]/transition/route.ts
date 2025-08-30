export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import youtubeProvider from '@/providers/video/youtube';

const Schema = z.object({ to: z.enum(['testing', 'live', 'complete']) });

export const POST = withAuth(async (ctx, req, context: any) => {
  const { params } = context as { params: { id: string } };
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const body = Schema.parse(await req.json());
    const ref = db.collection('liveDebates').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const d = snap.data() as any;
    if (!(d?.createdBy === uid || (ctx?.role === 'admin'))) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const broadcastId = d?.youtube?.broadcastId;
    if (!broadcastId) return NextResponse.json({ ok: false, error: 'no_broadcast' }, { status: 400 });
    await youtubeProvider.transition(uid, broadcastId, body.to);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Verified']) });
