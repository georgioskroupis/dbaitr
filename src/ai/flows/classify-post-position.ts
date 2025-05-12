'use server';

/**
 * @fileOverview Classifies a user's post as either 'For', 'Against', or 'Neutral' regarding a given debate topic.
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
      .enum(['For', 'Against', 'Neutral']) // Added 'Neutral'
      .describe('The classified position of the post (For, Against, or Neutral).'),
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
  prompt: `You are an AI that classifies user posts as "For", "Against", or "Neutral" regarding a given debate topic.\n
  Debate Topic: {{{topic}}}\n  User Post: {{{post}}}\n
  If the post clearly supports the topic, classify it as "For".
  If the post clearly opposes the topic, classify it as "Against".
  If the post is impartial, expresses no clear stance, asks a question without taking a side, or is off-topic, classify it as "Neutral".
  Also, provide a confidence level (0-1) for your classification.\n\n  Output in JSON format:\n  {\n    "position": "For" | "Against" | "Neutral",\n    "confidence": number (0-1)\n  }`,
});

const classifyPostPositionFlow = ai.defineFlow(
  {
    name: 'classifyPostPositionFlow',
    inputSchema: ClassifyPostPositionInputSchema,
    outputSchema: ClassifyPostPositionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure the output conforms, especially the enum.
    // If AI returns something not in enum, Zod parsing in definePrompt output would usually error.
    // Here we trust the AI and schema definition.
    return output!; 
  }
);
