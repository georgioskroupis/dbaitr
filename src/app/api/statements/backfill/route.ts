import { NextResponse } from 'next/server';
import { getDbAdmin, getAuthAdmin, FieldValue } from '@/lib/firebaseAdmin';
import { classifyPostPosition } from '@/ai/flows/classify-post-position';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || !(userDoc.data() as any)?.isAdmin) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const limit = 25;
    // Scan topics and classify pending statements
    const topicsSnap = await db.collection('topics').limit(50).get();
    let processed = 0;
    for (const t of topicsSnap.docs) {
      if (processed >= limit) break;
      const topicId = t.id;
      const topicTitle = (t.data() as any)?.title || '';
      const pendSnap = await db.collection('topics').doc(topicId).collection('statements').where('position', '==', 'pending').limit(limit - processed).get();
      for (const s of pendSnap.docs) {
        const d = s.data() as any;
        const result = await classifyPostPosition({ topic: topicTitle, post: d?.content || '' });
        await s.ref.set({ position: result.position, aiConfidence: result.confidence, lastEditedAt: new Date() }, { merge: true });
        // Update tallies
        const inc = FieldValue.increment(1) as any;
        const tallyUpdate: any = {};
        if (result.position === 'for') tallyUpdate.scoreFor = inc;
        else if (result.position === 'against') tallyUpdate.scoreAgainst = inc;
        else if (result.position === 'neutral') tallyUpdate.scoreNeutral = inc;
        if (Object.keys(tallyUpdate).length) await db.collection('topics').doc(topicId).set(tallyUpdate, { merge: true });
        processed++;
        if (processed >= limit) break;
      }
    }
    return NextResponse.json({ ok: true, processed });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

