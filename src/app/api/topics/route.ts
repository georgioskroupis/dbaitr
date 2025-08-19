import { NextResponse } from 'next/server';
import { getTopics } from '@/lib/firestoreActions';
import { logger } from '@/lib/logger';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';

export async function GET(req: Request) {
  try {
    const key = getClientKey(req);
    if (!globalRateLimiter.check(`topics:${key}`)) return NextResponse.json({ topics: [] }, { status: 429 });
    const topics = await getTopics();
    return NextResponse.json({ topics });
  } catch (err) {
    logger.error('[api/topics] Failed to fetch topics:', err);
    return NextResponse.json({ topics: [] }, { status: 200 });
  }
}
