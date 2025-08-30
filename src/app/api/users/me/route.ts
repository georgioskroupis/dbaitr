import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';

export const GET = withAuth(async (ctx, _req) => {
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return NextResponse.json({ ok: true, profile: null });
    return NextResponse.json({ ok: true, profile: { id: snap.id, ...(snap.data() as any) } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
});
