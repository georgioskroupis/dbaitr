export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import youtubeProvider from '@/providers/video/youtube';

export const POST = withAuth(async (_req, ctx: any) => {
  const { id } = (ctx?.params as any) || {};
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const ref = db.collection('liveDebates').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const d = snap.data() as any;
    const isPrivileged = ctx?.role === 'admin' || ctx?.role === 'super-admin';
    if (!(d?.createdBy === uid || isPrivileged)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const broadcastId = d?.youtube?.broadcastId;
    if (broadcastId) {
      try { await youtubeProvider.transition(uid, broadcastId, 'canceled'); } catch {}
    }
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(ref, { status: 'canceled', statusUpdatedAt: now }, { merge: true });
    batch.set(
      db.collection('liveRooms').doc(id),
      { title: d?.title || 'Live Debate', hostUid: d?.createdBy || '', status: 'ended', endedAt: now, updatedAt: now },
      { merge: true },
    );
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Verified']) });
