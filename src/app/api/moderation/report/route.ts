import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';

export const POST = withAuth(async (req, ctx: any) => {
  try {
    const key = getClientKey(req);
    if (!globalRateLimiter.check(`report:${key}`)) return NextResponse.json({ ok: false }, { status: 429 });
    const body = await req.json();
    const { topicId, statementId, threadId, reason, details } = body || {};
    if (!reason || !(topicId || statementId || threadId)) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ ok: false, error: 'Admin not configured' }, { status: 501 });
    const reporterUid = (ctx?.uid as string) || null;
    await db.collection('reports').add({
      topicId: topicId || null,
      statementId: statementId || null,
      threadId: threadId || null,
      reason,
      details: details || '',
      reporterId: reporterUid,
      createdAt: FieldValue.serverTimestamp(),
      status: 'open'
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[api/moderation/report] Failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
