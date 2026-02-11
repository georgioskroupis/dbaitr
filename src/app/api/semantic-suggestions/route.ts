import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';
import { findSimilarTopics, type FindSimilarTopicsInput } from '@/ai/flows/find-similar-topics';
import { logger } from '@/lib/logger';

export const POST = withAuth(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const query: string = (body?.query ?? '').toString();
    const topN: number | undefined = body?.topN;
    const similarityThreshold: number | undefined = body?.similarityThreshold;

    if (!query.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    const db = getDbAdmin();
    if (!db) return NextResponse.json({ suggestions: [] }, { status: 501 });
    const snap = await db.collection('topics').orderBy('createdAt', 'desc').limit(500).get();
    const existingTopicTitles = snap.docs.map((d) => (d.data()?.title || '')).filter(Boolean);
    if (!existingTopicTitles?.length) {
      return NextResponse.json({ suggestions: [] });
    }

    const input: FindSimilarTopicsInput = {
      query,
      existingTopicTitles,
      topN: topN ?? 5,
      similarityThreshold: similarityThreshold ?? 0.7,
    } as FindSimilarTopicsInput;

    const result = await findSimilarTopics(input);
    return NextResponse.json(result ?? { suggestions: [] });
  } catch (err: any) {
    logger.error('[api/semantic-suggestions] Error:', err);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}, { public: true });
// Ensure Node runtime for Genkit/GoogleAI
export const runtime = 'nodejs';
