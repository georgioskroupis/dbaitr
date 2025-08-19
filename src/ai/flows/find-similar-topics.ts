
'use server';
/**
 * @fileOverview AI-powered semantic search to find similar debate topics.
 *
 * - findSimilarTopics - A function that finds similar topics based on a query.
 * - FindSimilarTopicsInput - The input type for the findSimilarTopics function.
 * - FindSimilarTopicsOutput - The return type for the findSimilarTopics function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FindSimilarTopicsInputSchema = z.object({
  query: z.string().describe("The user's search query or new topic title."),
  existingTopicTitles: z
    .array(z.string())
    .describe('An array of titles of existing debate topics to compare against.'),
  topN: z.number().min(1).max(10).default(5).describe('The maximum number of similar topics to return.'),
  similarityThreshold: z.number().min(0).max(1).default(0.75).describe('The minimum similarity score for a topic to be considered a match (0.0 to 1.0).'),
});
export type FindSimilarTopicsInput = z.infer<typeof FindSimilarTopicsInputSchema>;

const SimilarTopicSuggestionSchema = z.object({
  title: z.string().describe('The title of the similar existing topic.'),
  score: z.number().min(0).max(1).describe('The semantic similarity score (0 to 1, where 1 is highly similar).'),
  matches: z
    .array(z.string())
    .default([])
    .describe('Specific words or short phrases in the title that semantically match the user query.'),
});
export type SimilarTopicSuggestion = z.infer<typeof SimilarTopicSuggestionSchema>;


const FindSimilarTopicsOutputSchema = z.object({
  suggestions: z
    .array(SimilarTopicSuggestionSchema)
    .describe('An array of suggested similar topics, sorted by similarity score in descending order.'),
});
export type FindSimilarTopicsOutput = z.infer<typeof FindSimilarTopicsOutputSchema>;

export async function findSimilarTopics(input: FindSimilarTopicsInput): Promise<FindSimilarTopicsOutput> {
  return findSimilarTopicsFlow(input);
}

const findSimilarTopicsPrompt = ai.definePrompt({
  name: 'findSimilarTopicsPrompt',
  input: {schema: FindSimilarTopicsInputSchema},
  output: {schema: FindSimilarTopicsOutputSchema},
  prompt: `You are an advanced semantic search assistant for a debate platform.
Your task is to identify existing debate topics that are semantically similar to a user's query.

User's Query: "{{query}}"

List of Existing Topic Titles to Search Within:
{{#if existingTopicTitles.length}}
{{#each existingTopicTitles}}
- "{{this}}"
{{/each}}
{{else}}
(No existing topics provided for comparison)
{{/if}}

Instructions:
1. Analyze the User's Query and each Existing Topic Title for semantic meaning and intent.
2. For each existing topic, calculate a similarity score between 0.0 (not similar) and 1.0 (very similar or identical) compared to the User's Query.
3. Identify up to {{topN}} existing topics that have a similarity score greater than or equal to {{similarityThreshold}}.
4. For each identified topic, determine an array of specific words or short phrases ("matches") from its title that are most semantically relevant to the User's Query.
5. Sort these identified topics by their similarity score in descending order (most similar first).
6. If no topics meet the threshold, return an empty array for "suggestions".

Output the results STRICTLY in the following JSON format:
{
  "suggestions": [
    { "title": "Existing Topic Title 1", "score": 0.92, "matches": ["word1", "phrase2"] },
    { "title": "Existing Topic Title 2", "score": 0.85, "matches": ["relevant part"] }
  ]
}

Example of output if "Global Warming Solutions" is the query and existing topics are provided:
{
  "suggestions": [
    { "title": "Effective strategies to combat climate change", "score": 0.95, "matches": ["climate change", "strategies"] },
    { "title": "The impact of renewable energy on global warming", "score": 0.88, "matches": ["renewable energy", "global warming"] }
  ]
}

Example of output if no sufficiently similar topics are found:
{
  "suggestions": []
}

Begin analysis.
`,
});

const findSimilarTopicsFlow = ai.defineFlow(
  {
    name: 'findSimilarTopicsFlow',
    inputSchema: FindSimilarTopicsInputSchema,
    outputSchema: FindSimilarTopicsOutputSchema,
  },
  async (input: FindSimilarTopicsInput) => {
    // Ensure defaults are applied if not provided
    const processedInput = {
      ...input,
      topN: input.topN ?? 5,
      similarityThreshold: input.similarityThreshold ?? 0.75,
    };

    if (!processedInput.existingTopicTitles || processedInput.existingTopicTitles.length === 0) {
      return { suggestions: [] };
    }

    const {output} = await findSimilarTopicsPrompt(processedInput);
    // Ensure a valid output structure and normalize matches to []
    if (output && Array.isArray(output.suggestions)) {
      return {
        suggestions: output.suggestions.map(s => ({
          title: s.title,
          score: s.score,
          matches: Array.isArray((s as any).matches) ? (s as any).matches : [],
        })),
      };
    }
    return { suggestions: [] };
  }
);
