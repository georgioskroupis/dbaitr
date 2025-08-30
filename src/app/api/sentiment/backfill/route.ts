import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger';
import { getClientKey, globalRateLimiter } from '@/lib/rateLimit';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const POST = withAuth(async (_ctx, req) => {
  try {
    const key = getClientKey(req);
    if (!globalRateLimiter.check(`sentiment-backfill:${key}`)) return NextResponse.json({ ok: false }, { status: 429 });
    const db = getDbAdmin();

    const { limit = 10 } = await req.json().catch(() => ({}));
    const topicsSnap = await db.collection('topics').limit(20).get();
    let processed = 0;
    for (const t of topicsSnap.docs) {
      const statementsSnap = await t.ref.collection('statements').orderBy('createdAt', 'desc').limit(20).get();
      for (const s of statementsSnap.docs) {
        const d = s.data() as any;
        if (!d?.content) continue;
        if (!d?.sentiment) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/sentiment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 'statement', topicId: t.id, statementId: s.id, text: d.content }) });
          processed++;
          if (processed >= limit) return NextResponse.json({ ok: true, processed });
        }
        // Intentionally not backfilling threads — only initial statements contribute to sentiment
      }
    }
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    logger.error('[api/sentiment/backfill] Failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
