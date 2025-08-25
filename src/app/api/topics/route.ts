import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';
import { getDbAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const key = getClientKey(req);
    if (!globalRateLimiter.check(`topics:${key}`)) return NextResponse.json({ topics: [] }, { status: 429 });
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ topics: [] }, { status: 501 });
    const snap = await db.collection('topics').orderBy('createdAt', 'desc').get();
    const topics = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    return NextResponse.json({ topics });
  } catch (err) {
    logger.error('[api/topics] Failed to fetch topics:', err);
    return NextResponse.json({ topics: [] }, { status: 200 });
  }
}
