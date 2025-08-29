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
    const uid = decoded.uid;
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return NextResponse.json({ ok: true, profile: null });
    return NextResponse.json({ ok: true, profile: { id: snap.id, ...(snap.data() as any) } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}

