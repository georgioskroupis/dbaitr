import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';
import { classifyPostPosition } from '@/ai/flows/classify-post-position';

export const runtime = 'nodejs';

export const POST = withAuth(async (_ctx, req) => {
  try {
    const db = getDbAdmin();

    const limit = 25;
    // Scan topics and classify pending statements
    const topicsSnap = await db.collection('topics').limit(50).get();
    let processed = 0;
    const touched = new Set<string>();
    for (const t of topicsSnap.docs) {
      if (processed >= limit) break;
      const topicId = t.id;
      const topicTitle = (t.data() as any)?.title || '';
      const pendSnap = await db.collection('topics').doc(topicId).collection('statements').where('position', '==', 'pending').limit(limit - processed).get();
      for (const s of pendSnap.docs) {
        const d = s.data() as any;
        const result = await classifyPostPosition({ topic: topicTitle, post: d?.content || '' });
        await s.ref.set({ position: result.position, aiConfidence: result.confidence, lastEditedAt: new Date() }, { merge: true });
        processed++;
        touched.add(topicId);
        if (processed >= limit) break;
      }
    }
    // Recompute tallies for touched topics
    for (const topicId of touched) {
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
    return NextResponse.json({ ok: true, processed, topicsUpdated: touched.size });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
