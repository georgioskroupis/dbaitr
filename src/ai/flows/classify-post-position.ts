'use server';

/**
 * @fileOverview Classifies a user's post as either 'For' or 'Against' a given debate topic.
 *
 * - classifyPostPosition - A function that classifies the post position.
 * - ClassifyPostPositionInput - The input type for the classifyPostPosition function.
 * - ClassifyPostPositionOutput - The return type for the classifyPostPosition function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClassifyPostPositionInputSchema = z.object({
  topic: z.string().describe('The debate topic.'),
  post: z.string().describe('The user post to classify.'),
});
export type ClassifyPostPositionInput = z.infer<typeof ClassifyPostPositionInputSchema>;

const ClassifyPostPositionOutputSchema = z.object({
  position:
    z
      .enum(['For', 'Against'])
      .describe('The classified position of the post (For or Against).'),
  confidence: z.number().describe('The confidence level of the classification (0-1).'),
});
export type ClassifyPostPositionOutput = z.infer<typeof ClassifyPostPositionOutputSchema>;

export async function classifyPostPosition(input: ClassifyPostPositionInput): Promise<ClassifyPostPositionOutput> {
  return classifyPostPositionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'classifyPostPositionPrompt',
  input: {schema: ClassifyPostPositionInputSchema},
  output: {schema: ClassifyPostPositionOutputSchema},
  prompt: `You are an AI that classifies user posts as either \"For\" or \"Against\" a given debate topic.\n
  Debate Topic: {{{topic}}}\n  User Post: {{{post}}}\n
  Classify the user post as either \"For\" or \"Against\" the topic. Also, provide a confidence level (0-1) for your classification.\n\n  Output in JSON format:\n  {\n    \"position\": \"For\" | \"Against\",\n    \"confidence\": number (0-1)\n  }`,
});

const classifyPostPositionFlow = ai.defineFlow(
  {
    name: 'classifyPostPositionFlow',
    inputSchema: ClassifyPostPositionInputSchema,
    outputSchema: ClassifyPostPositionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

