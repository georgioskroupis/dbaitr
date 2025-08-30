import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_ctx, req) => {
  try {
    const key = getClientKey(req);
    if (!globalRateLimiter.check(`topics:${key}`)) return NextResponse.json({ topics: [] }, { status: 429 });
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ topics: [] }, { status: 501 });
    const snap = await db.collection('topics').orderBy('createdAt', 'desc').get();
    const topics = snap.docs.map((d) => {
      const data: any = d.data() || {};
      const toISO = (ts: any) => {
        try {
          if (!ts) return undefined;
          if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
          if (ts.seconds !== undefined && ts.nanoseconds !== undefined) {
            return new Date(ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1e6)).toISOString();
          }
          if (ts instanceof Date) return ts.toISOString();
        } catch {}
        return ts;
      };
      if (data.createdAt) data.createdAt = toISO(data.createdAt);
      if (data.updatedAt) data.updatedAt = toISO(data.updatedAt);
      return { id: d.id, ...data };
    });
    return NextResponse.json({ topics });
  } catch (err) {
    logger.error('[api/topics] Failed to fetch topics:', err);
    return NextResponse.json({ topics: [] }, { status: 200 });
  }
}, { public: true });
