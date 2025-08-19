import { NextResponse } from 'next/server';
import { getAllTopicTitles } from '@/lib/firestoreActions';
import { findSimilarTopics, type FindSimilarTopicsInput, type FindSimilarTopicsOutput } from '@/ai/flows/find-similar-topics';
import { logger } from '@/lib/logger';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';

// Ensure Node runtime (Genkit/GoogleAI require Node APIs)
export const runtime = 'nodejs';

// Lightweight in-memory caches (per warm lambda/process)
const SUGGEST_TTL_MS = 60_000; // cache suggestions for 60s per query
const TITLES_TTL_MS = 60_000;  // cache titles for 60s
const suggestCache = new Map<string, { ts: number; result: FindSimilarTopicsOutput }>();
let titlesCache: { ts: number; titles: string[] } | null = null;

export async function GET(req: Request) {
  try {
    const key = getClientKey(req);
    if (!globalRateLimiter.check(`suggest:${key}`)) return NextResponse.json({ suggestions: [] }, { status: 429 });
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').toString();
    const topN = searchParams.get('topN');
    const threshold = searchParams.get('similarityThreshold');

    if (!q.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    const hasAIKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    if (!hasAIKey) {
      logger.error('[api/search/suggest] Missing GEMINI_API_KEY/GOOGLE_API_KEY');
      return NextResponse.json({ suggestions: [], error: 'Missing GEMINI_API_KEY/GOOGLE_API_KEY' }, { status: 500 });
    }

    // Titles cache
    const now = Date.now();
    let titles: string[] | undefined;
    if (titlesCache && now - titlesCache.ts < TITLES_TTL_MS) {
      titles = titlesCache.titles;
    } else {
      titles = await getAllTopicTitles().catch((e) => {
        logger.error('[api/search/suggest] getAllTopicTitles failed:', e);
        throw new Error('Failed to load topic titles from Firestore');
      });
      titlesCache = { ts: now, titles };
    }
    if (!titles?.length) return NextResponse.json({ suggestions: [] });

    // Pre-filter titles to cut payload size and latency
    const qLower = q.toLowerCase();
    let candidateTitles = titles.filter((t) => t && t.toLowerCase().includes(qLower));
    if (candidateTitles.length === 0) {
      candidateTitles = titles;
    }
    // Hard cap to limit token usage; take first 150
    if (candidateTitles.length > 150) {
      candidateTitles = candidateTitles.slice(0, 150);
    }

    // Suggestions cache by normalized query
    const cacheKey = `${qLower}`;
    const cached = suggestCache.get(cacheKey);
    if (cached && now - cached.ts < SUGGEST_TTL_MS) {
      return NextResponse.json(cached.result);
    }

    const input: FindSimilarTopicsInput = {
      query: q,
      existingTopicTitles: candidateTitles,
      topN: topN ? Number(topN) : 5,
      similarityThreshold: threshold ? Number(threshold) : 0.7,
    } as FindSimilarTopicsInput;

    const result = await findSimilarTopics(input).catch((e: any) => {
      logger.error('[api/search/suggest] findSimilarTopics failed:', e);
      throw new Error(e?.message || 'AI suggestion generation failed');
    });
    suggestCache.set(cacheKey, { ts: now, result: result ?? { suggestions: [] } });
    return NextResponse.json(result ?? { suggestions: [] });
  } catch (err) {
    logger.error('[api/search/suggest] Error:', err);
    // Return 500 with an error message for client diagnostics
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ suggestions: [], error: message }, { status: 500 });
  }
}
