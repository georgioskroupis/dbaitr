'use server';

/**
 * @fileOverview AI-powered semantic search to prevent duplicate debate topics.
 *
 * - checkTopicSimilarity - A function that checks the similarity of a new topic with existing topics.
 * - CheckTopicSimilarityInput - The input type for the checkTopicSimilarity function.
 * - CheckTopicSimilarityOutput - The return type for the checkTopicSimilarity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CheckTopicSimilarityInputSchema = z.object({
  newTopic: z.string().describe('The title of the new debate topic.'),
  existingTopics: z
    .array(z.string())
    .describe('An array of titles of existing debate topics.'),
});
export type CheckTopicSimilarityInput = z.infer<typeof CheckTopicSimilarityInputSchema>;

const CheckTopicSimilarityOutputSchema = z.object({
  isSimilar: z
    .boolean()
    .describe(
      'Whether the new topic is similar to any of the existing topics based on semantic similarity.'
    ),
  closestMatch: z
    .string()
    .optional()
    .describe('The existing topic that is most similar to the new topic.'),
  similarityScore: z
    .number()
    .optional()
    .describe('A score indicating the similarity between the new topic and the closest match.'),
  guidanceMessage: z
    .string()
    .describe(
      'A message to guide the user to create a novel topic, if the topic is similar, or encourage them if it is unique.'
    ),
});
export type CheckTopicSimilarityOutput = z.infer<typeof CheckTopicSimilarityOutputSchema>;

export async function checkTopicSimilarity(input: CheckTopicSimilarityInput): Promise<CheckTopicSimilarityOutput> {
  return checkTopicSimilarityFlow(input);
}

const checkTopicSimilarityPrompt = ai.definePrompt({
  name: 'checkTopicSimilarityPrompt',
  input: {schema: CheckTopicSimilarityInputSchema},
  output: {schema: CheckTopicSimilarityOutputSchema},
  prompt: `You are a debate topic originality checker.

You are given a new debate topic and a list of existing debate topics.

Determine if the new topic is similar to any of the existing topics based on semantic similarity.

If it is similar, provide the closest matching existing topic, a similarity score (0-1, with 1 being identical), and a guidance message to help the user create a more novel topic.

If it is not similar, set isSimilar to false and provide an encouraging message.

New Topic: {{{newTopic}}}
Existing Topics:
{{#each existingTopics}}
- {{{this}}}
{{/each}}

Output in JSON format:
{
  "isSimilar": boolean,
  "closestMatch": string (if similar),
  "similarityScore": number (0-1, if similar),
  "guidanceMessage": string
}
`,
});

const checkTopicSimilarityFlow = ai.defineFlow(
  {
    name: 'checkTopicSimilarityFlow',
    inputSchema: CheckTopicSimilarityInputSchema,
    outputSchema: CheckTopicSimilarityOutputSchema,
  },
  async input => {
    const {output} = await checkTopicSimilarityPrompt(input);
    return output!;
  }
);

