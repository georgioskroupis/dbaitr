import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const key = getClientKey(req);
    if (!globalRateLimiter.check(`report:${key}`)) return NextResponse.json({ ok: false }, { status: 429 });
    const body = await req.json();
    const { topicId, statementId, threadId, reason, details, reporterId } = body || {};
    if (!reason || !(topicId || statementId || threadId)) return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    await addDoc(collection(db, 'reports'), {
      topicId: topicId || null,
      statementId: statementId || null,
      threadId: threadId || null,
      reason,
      details: details || '',
      reporterId: reporterId || null,
      createdAt: serverTimestamp(),
      status: 'open'
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[api/moderation/report] Failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

