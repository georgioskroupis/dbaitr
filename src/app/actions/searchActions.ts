
'use server';

import { getDbAdmin } from '@/lib/firebaseAdmin';
import { findSimilarTopics, type FindSimilarTopicsOutput, type FindSimilarTopicsInput } from '@/ai/flows/find-similar-topics';
import { logger } from '@/lib/logger';

interface GetSemanticSuggestionsParams {
  query: string;
  topN?: number;
  similarityThreshold?: number;
}

export async function getSemanticTopicSuggestions(
  params: GetSemanticSuggestionsParams
): Promise<FindSimilarTopicsOutput> { // Ensure this returns the full output type
  const { query, topN = 5, similarityThreshold = 0.70 } = params; 

  if (!query.trim()) {
    return { suggestions: [] };
  }

  try {
    // In a production app with many topics, this next line is a bottleneck.
    // You'd ideally pre-filter titles based on keywords before sending to the LLM,
    // or use a vector database for true semantic search.
    const db = getDbAdmin();
    if (!db) return { suggestions: [] };
    const snap = await db.collection('topics').orderBy('createdAt', 'desc').limit(500).get();
    const existingTopicTitles = snap.docs.map((d) => (d.data()?.title || '')).filter(Boolean);

    if (existingTopicTitles.length === 0) {
      return { suggestions: [] };
    }
    
    logger.debug(`[getSemanticTopicSuggestions] Checking query "${query}" against ${existingTopicTitles.length} titles.`);

    const result = await findSimilarTopics({
      query,
      existingTopicTitles,
      topN,
      similarityThreshold,
    } as FindSimilarTopicsInput); 
    
    logger.debug(`[getSemanticTopicSuggestions] AI found ${result.suggestions.length} suggestions. Full result:`, JSON.stringify(result, null, 2));
    return result; // Return the full FindSimilarTopicsOutput which includes the suggestions array

  } catch (error) {
    logger.error('[getSemanticTopicSuggestions Server Action] Error:', error);
    return { suggestions: [] };
  }
}
