
'use server';

/**
 * @fileOverview Classifies a user's post as either 'for', 'against', or 'neutral' regarding a given debate topic.
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
      .enum(['for', 'against', 'neutral']) // Changed to lowercase
      .describe('The classified position of the post (for, against, or neutral).'),
  confidence: z.number().min(0).max(1).describe('The confidence level of the classification (0-1).'),
});
export type ClassifyPostPositionOutput = z.infer<typeof ClassifyPostPositionOutputSchema>;

export async function classifyPostPosition(input: ClassifyPostPositionInput): Promise<ClassifyPostPositionOutput> {
  return classifyPostPositionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'classifyPostPositionPrompt',
  input: {schema: ClassifyPostPositionInputSchema},
  output: {schema: ClassifyPostPositionOutputSchema},
  prompt: `You are an AI that classifies user posts as "for", "against", or "neutral" regarding a given debate topic.\n
  Debate Topic: {{{topic}}}\n  User Post: {{{post}}}\n
  If the post clearly supports the topic, classify it as "for".
  If the post clearly opposes the topic, classify it as "against".
  If the post is impartial, expresses no clear stance, asks a question without taking a side, or is off-topic, classify it as "neutral".
  Also, provide a confidence level (0-1) for your classification.\n\n  Output in JSON format:\n  {\n    "position": "for" | "against" | "neutral",\n    "confidence": number (0-1)\n  }`,
});

const classifyPostPositionFlow = ai.defineFlow(
  {
    name: 'classifyPostPositionFlow',
    inputSchema: ClassifyPostPositionInputSchema,
    outputSchema: ClassifyPostPositionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // The Zod schema in definePrompt will validate the output format including the enum.
    // If the AI returns an invalid enum value, an error will be thrown by Genkit during response parsing.
    return output!;
  }
);
