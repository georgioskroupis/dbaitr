export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const auth = getAuthAdmin();
    if (!auth) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    // Use custom claims embedded in the ID token to avoid extra Admin SDK privilege needs
    const claims = (decoded as any) || {};
    const role = claims.role || null;
    return NextResponse.json({ ok: true, uid: decoded.uid, role, claims });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
