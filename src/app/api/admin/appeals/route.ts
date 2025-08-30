export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const GET = withAuth(async (_ctx, _req) => {
  try {
    const db = getDbAdmin();

    let appeals: any[] = [];
    const errors: string[] = [];
    try {
      const snap = await db.collection('appeals').orderBy('createdAt', 'desc').limit(100).get();
      appeals = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    } catch (err: any) {
      errors.push(`appeals:${err?.message || err}`);
      try {
        const fallback = await db.collection('appeals').limit(100).get();
        appeals = fallback.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      } catch {}
    }

    return NextResponse.json({ ok: true, appeals, errors: errors.length ? errors : undefined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
