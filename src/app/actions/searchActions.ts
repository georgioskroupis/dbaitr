
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
): Promise<FindSimilarTopicsOutput> { // Ensure this returns the full output type
  const { query, topN = 5, similarityThreshold = 0.70 } = params; 

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
    } as FindSimilarTopicsInput); 
    
    if (process.env.NODE_ENV !== "production") {
        console.log(`[getSemanticTopicSuggestions] AI found ${result.suggestions.length} suggestions. Full result:`, JSON.stringify(result, null, 2));
    }
    return result; // Return the full FindSimilarTopicsOutput which includes the suggestions array

  } catch (error) {
    console.error('[getSemanticTopicSuggestions Server Action] Error:', error);
    return { suggestions: [] };
  }
}
