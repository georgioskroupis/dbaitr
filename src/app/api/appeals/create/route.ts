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
    const body = await req.json();
    const { topicId, statementId, threadId, reason } = body || {};
    if (!reason || !(statementId || threadId || topicId)) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    const doc = await db.collection('appeals').add({
      topicId: topicId || null,
      statementId: statementId || null,
      threadId: threadId || null,
      reason,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      status: 'open',
    });
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
