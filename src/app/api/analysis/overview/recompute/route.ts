import { NextResponse } from 'next/server';
import { getAuthAdmin, getAppCheckAdmin, getDbAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

async function verifyAppCheck(req: Request) {
  const appCheck = getAppCheckAdmin();
  const hdr = req.headers.get('X-Firebase-AppCheck') || req.headers.get('X-Firebase-AppCheck-Token');
  if (!appCheck) return process.env.NODE_ENV !== 'production';
  if (!hdr) return process.env.NODE_ENV !== 'production';
  try { await appCheck.verifyToken(hdr); return true; } catch { return false; }
}

export async function POST(req: Request) {
  try {
    if (!(await verifyAppCheck(req))) return NextResponse.json({ ok: false, error: 'appcheck' }, { status: 401 });
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const claims = (decoded as any) || {};
    // In non-production, allow any authenticated user to trigger while iterating
    if (process.env.NODE_ENV !== 'production') {
      const { topicId } = await req.json();
      if (!topicId) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
      const { evaluateDiscussionOverview } = await import('@/lib/server/analysis');
      const res = await evaluateDiscussionOverview(String(topicId), 'event');
      return NextResponse.json({ ok: true, result: res });
    }
    let isAllowed =
      claims.role === 'admin' ||
      claims.role === 'moderator' ||
      claims.isAdmin === true ||
      claims.isModerator === true ||
      claims.isSuperAdmin === true ||
      claims.admin === true;
    if (!isAllowed) {
      try {
        const uid = decoded.uid;
        const uSnap = await db.collection('users').doc(uid).get();
        const u = (uSnap.exists ? (uSnap.data() as any) : {}) || {};
        isAllowed = !!(u.isAdmin || u.isModerator);
      } catch {}
    }
    if (!isAllowed) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const { topicId } = await req.json();
    if (!topicId) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    const { evaluateDiscussionOverview } = await import('@/lib/server/analysis');
    const res = await evaluateDiscussionOverview(String(topicId), 'event');
    return NextResponse.json({ ok: true, result: res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server_error' }, { status: 500 });
  }
}
