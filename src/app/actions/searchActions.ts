'use server';

import { getAllTopicTitles } from '@/lib/firestoreActions';
import { findSimilarTopics, type FindSimilarTopicsOutput, type FindSimilarTopicsInput } from '@/ai/flows/find-similar-topics';

interface GetSemanticSuggestionsParams {
  query: string;
  topN?: number;
  similarityThreshold?: number;
}

export async function getSemanticTopicSuggestions(
  params: GetSemanticSuggestionsParams
): Promise<FindSimilarTopicsOutput> {
  const { query, topN = 5, similarityThreshold = 0.70 } = params; // Adjusted default threshold slightly

  if (!query.trim()) {
    return { suggestions: [] };
  }

  try {
    // In a production app with many topics, this next line is a bottleneck.
    // You'd ideally pre-filter titles based on keywords before sending to the LLM,
    // or use a vector database for true semantic search.
    const existingTopicTitles = await getAllTopicTitles();

    if (existingTopicTitles.length === 0) {
      return { suggestions: [] };
    }
    
    if (process.env.NODE_ENV !== "production") {
        console.log(`[getSemanticTopicSuggestions] Checking query "${query}" against ${existingTopicTitles.length} titles.`);
    }

    const result = await findSimilarTopics({
      query,
      existingTopicTitles,
      topN,
      similarityThreshold,
    } as FindSimilarTopicsInput); // Cast to ensure all defaults from schema are met if not passed by caller
    
    if (process.env.NODE_ENV !== "production") {
        console.log(`[getSemanticTopicSuggestions] AI found ${result.suggestions.length} suggestions.`);
    }
    return result;

  } catch (error) {
    console.error('[getSemanticTopicSuggestions Server Action] Error:', error);
    // Depending on the error, you might want to return a specific error structure or just empty suggestions
    return { suggestions: [] };
  }
}
