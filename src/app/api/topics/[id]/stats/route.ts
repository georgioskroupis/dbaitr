import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_ctx, _req, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const topicId = id;
  if (!topicId) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });

  try {
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ ok: false, error: 'admin_unavailable' }, { status: 500 });

    let totalStatements = 0;
    let totalQuestions = 0;
    let percentQuestionsAnswered = 0;

    // Statements under topic
    try {
      const stSnap = await db.collection('topics').doc(topicId).collection('statements').get();
      totalStatements = stSnap.size;
    } catch {}

    // Questions via collection group
    let questionIds: Set<string> = new Set();
    try {
      const qSnap = await db.collectionGroup('threads')
        .where('topicId', '==', topicId)
        .where('type', '==', 'question')
        .get();
      totalQuestions = qSnap.size;
      questionIds = new Set(qSnap.docs.map(d => d.id));
    } catch {}

    // Responses by authors to those questions
    try {
      const rSnap = await db.collectionGroup('threads')
        .where('topicId', '==', topicId)
        .where('type', '==', 'response')
        .get();
      const answered = new Set<string>();
      for (const d of rSnap.docs) {
        const data: any = d.data() || {};
        const parentId = data.parentId;
        const byAuthor = data.createdBy && data.statementAuthorId && data.createdBy === data.statementAuthorId;
        if (parentId && byAuthor && questionIds.has(parentId)) answered.add(parentId);
      }
      percentQuestionsAnswered = totalQuestions > 0 ? (answered.size / totalQuestions) * 100 : 0;
    } catch {}

    return NextResponse.json({
      ok: true,
      totalStatements,
      totalQuestions,
      percentQuestionsAnswered,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server_error' }, { status: 500 });
  }
}, { public: true });
