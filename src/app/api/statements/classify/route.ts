import { NextResponse } from 'next/server';
import { getDbAdmin, getAuthAdmin } from '@/lib/firebaseAdmin';
import { classifyPostPosition } from '@/ai/flows/classify-post-position';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const decoded = await auth.verifyIdToken(token);
    const { topicId, statementId, text } = await req.json();
    if (!topicId || !statementId || !text) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    // Only allow the author or admins/moderators to trigger classification for now
    const snap = await db.collection('topics').doc(topicId).collection('statements').doc(statementId).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const d = snap.data() as any;
    const isOwner = d?.createdBy && d.createdBy === decoded.uid;
    const isPrivileged = !!(decoded as any).isAdmin || !!(decoded as any).isModerator;
    if (!isOwner && !isPrivileged) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    // Fetch topic title for better context
    let topicTitle = '';
    try {
      const t = await db.collection('topics').doc(topicId).get();
      topicTitle = (t.data() as any)?.title || '';
    } catch {}
    const result = await classifyPostPosition({ topic: topicTitle, post: text });
    await db.collection('topics').doc(topicId).collection('statements').doc(statementId).set({ position: result.position, aiConfidence: result.confidence, lastEditedAt: new Date() }, { merge: true });
    return NextResponse.json({ ok: true, position: result.position, confidence: result.confidence });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
