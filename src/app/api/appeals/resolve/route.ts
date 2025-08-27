import { NextResponse } from 'next/server';
import { getDbAdmin, getAuthAdmin, FieldValue } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const db = getDbAdmin();
    const auth = getAuthAdmin();
    if (!db || !auth) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    // Optional: check admin claim via Firestore users doc on server for extra reliability
    const userDoc = await db.collection('users').doc(uid).get();
    const u = userDoc.data() as any;
    if (!(u?.isAdmin || u?.isModerator)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const body = await req.json();
    const { appealId, decision, rationale } = body || {};
    if (!appealId || !decision || !['approved', 'denied'].includes(decision)) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }
    await db.collection('appeals').doc(appealId).set({
      status: 'resolved',
      decision,
      rationale: rationale || '',
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: uid,
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

