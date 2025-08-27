import { NextResponse } from 'next/server';
import { getDbAdmin, getAuthAdmin, getAppCheckAdmin, FieldValue } from '@/lib/firebaseAdmin';
import { classifyPostPosition } from '@/ai/flows/classify-post-position';

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

async function recomputeTallies(db: FirebaseFirestore.Firestore, topicId: string) {
  const base = db.collection('topics').doc(topicId).collection('statements');
  const [forSnap, againstSnap, neutralSnap] = await Promise.all([
    base.where('position', '==', 'for').get(),
    base.where('position', '==', 'against').get(),
    base.where('position', '==', 'neutral').get(),
  ]);
  await db.collection('topics').doc(topicId).set({
    scoreFor: forSnap.size,
    scoreAgainst: againstSnap.size,
    scoreNeutral: neutralSnap.size,
  }, { merge: true });
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

    const body = await req.json();
    const { topicId, content, claimType, sourceUrl } = body || {};
    if (!topicId || !content || !claimType) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    if (claimType === 'fact' && (!sourceUrl || typeof sourceUrl !== 'string' || sourceUrl.length < 5)) {
      return NextResponse.json({ ok: false, error: 'source_required' }, { status: 400 });
    }

    // Gate: kycVerified or within grace window
    const userDoc = await db.collection('users').doc(uid).get();
    const u = userDoc.data() as any || {};
    const ok = !!u.kycVerified || withinGrace(u.registeredAt);
    if (!ok) return NextResponse.json({ ok: false, error: 'kyc_required' }, { status: 403 });

    const topicRef = db.collection('topics').doc(topicId);
    const ref = await topicRef.collection('statements').add({
      topicId,
      content,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      position: 'pending',
      claimType,
      ...(claimType === 'fact' && sourceUrl ? { sourceUrl } : {}),
    });
    // Classify position server-side for reliability
    try {
      const topicSnap = await topicRef.get();
      const topicTitle = (topicSnap.data() as any)?.title || '';
      const result = await classifyPostPosition({ topic: topicTitle, post: content });
      const pos = result.position;
      await ref.set({ position: pos, aiConfidence: result.confidence, lastEditedAt: new Date() }, { merge: true });
      // Safer: recompute tallies to avoid drift if positions change later
      await recomputeTallies(db, topicId);
    } catch {}
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
