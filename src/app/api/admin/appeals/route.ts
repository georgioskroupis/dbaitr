export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const role = (decoded as any)?.role || 'viewer';
    if (role !== 'admin') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

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
}
