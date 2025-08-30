import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const POST = withAuth(async (ctx, req) => {
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
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
}, { ...requireStatus(['Grace','Verified']) });
