import { NextResponse } from 'next/server';
import { getAllTopicTitles } from '@/lib/firestoreActions';
import { findSimilarTopics, type FindSimilarTopicsInput } from '@/ai/flows/find-similar-topics';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const query: string = (body?.query ?? '').toString();
    const topN: number | undefined = body?.topN;
    const similarityThreshold: number | undefined = body?.similarityThreshold;

    if (!query.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    const existingTopicTitles = await getAllTopicTitles();
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
}
// Ensure Node runtime for Genkit/GoogleAI
export const runtime = 'nodejs';
