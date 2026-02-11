import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { classifyPostPosition } from '@/ai/flows/classify-post-position';

export const runtime = 'nodejs';

export const POST = withAuth(async (req, ctx: any) => {
  try {
    const db = getDbAdmin();
    const { topicId, statementId, text } = await req.json();
    if (!topicId || !statementId || !text) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    // Only allow the author or admins/moderators to trigger classification for now
    const snap = await db.collection('topics').doc(topicId).collection('statements').doc(statementId).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const d = snap.data() as any;
    const isOwner = d?.createdBy && d.createdBy === (ctx?.uid as string);
    const isPrivileged = (ctx?.role === 'admin') || (ctx?.role === 'moderator');
    if (!isOwner && !isPrivileged) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    // Fetch topic title for better context
    let topicTitle = '';
    try {
      const t = await db.collection('topics').doc(topicId).get();
      topicTitle = (t.data() as any)?.title || '';
    } catch {}
    const result = await classifyPostPosition({ topic: topicTitle, post: text });
    await db.collection('topics').doc(topicId).collection('statements').doc(statementId).set({ position: result.position, aiConfidence: result.confidence, lastEditedAt: new Date() }, { merge: true });
    // Safer tallies: recompute counts
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
    return NextResponse.json({ ok: true, position: result.position, confidence: result.confidence });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
