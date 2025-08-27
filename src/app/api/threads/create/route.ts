import { NextResponse } from 'next/server';
import { getDbAdmin, getAuthAdmin, getAppCheckAdmin, FieldValue } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

function withinGrace(registeredAt: any, days = 10): boolean {
  try {
    let d: Date | null = null;
    if (!registeredAt) return false;
    if (typeof registeredAt?.toDate === 'function') d = registeredAt.toDate();
    else if (typeof registeredAt === 'string') d = new Date(registeredAt);
    else if (registeredAt?.seconds) d = new Date(registeredAt.seconds * 1000);
    if (!d || Number.isNaN(d.getTime())) return false;
    const end = new Date(d); end.setDate(end.getDate() + days);
    return new Date() <= end;
  } catch { return false; }
}

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
    const uid = decoded.uid;

    const { topicId, statementId, statementAuthorId, parentId, content, type } = await req.json();
    if (!topicId || !statementId || !content || !type) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    if (type !== 'question' && type !== 'response') return NextResponse.json({ ok: false, error: 'bad_type' }, { status: 400 });

    // Gate: kycVerified or within grace
    const userDoc = await db.collection('users').doc(uid).get();
    const u = userDoc.data() as any || {};
    const ok = !!u.kycVerified || withinGrace(u.registeredAt);
    if (!ok) return NextResponse.json({ ok: false, error: 'kyc_required' }, { status: 403 });

    // Enforce question limits and response rights
    if (type === 'question') {
      const snap = await db.collection('topics').doc(topicId).collection('statements').doc(statementId)
        .collection('threads').where('createdBy', '==', uid).where('type', '==', 'question').get();
      if (snap.size >= 3) return NextResponse.json({ ok: false, error: 'limit' }, { status: 403 });
    } else if (type === 'response') {
      if (!statementAuthorId || uid !== statementAuthorId) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const ref = await db.collection('topics').doc(topicId).collection('statements').doc(statementId)
      .collection('threads').add({
        topicId,
        statementId,
        statementAuthorId: statementAuthorId || null,
        parentId: parentId || null,
        content,
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
        type,
      });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

