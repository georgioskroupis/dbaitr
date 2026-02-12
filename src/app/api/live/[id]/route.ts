export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';

export const DELETE = withAuth(async (_req, ctx: any) => {
  const id = (ctx?.params as any)?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const ref = db.collection('liveDebates').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const d = snap.data() as any;
    const isPrivileged = ctx?.role === 'admin' || ctx?.role === 'super-admin';
    if (!(d?.createdBy === uid || isPrivileged)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Verified']) });
