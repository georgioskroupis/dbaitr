'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({
  text: z.string().describe('The user statement to classify.'),
  topic: z.string().optional().describe('Optional topic title for context.'),
});
export type ClassifyClaimInput = z.infer<typeof InputSchema>;

const OutputSchema = z.object({
  claimType: z.enum(['opinion', 'experience', 'fact']).describe('Predicted claim type.'),
  confidence: z.number().min(0).max(1).describe('Confidence 0-1.'),
});
export type ClassifyClaimOutput = z.infer<typeof OutputSchema>;

export async function classifyClaimType(input: ClassifyClaimInput): Promise<ClassifyClaimOutput> {
  return classifyClaimTypeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'classifyClaimTypePrompt',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `Classify the user's statement as one of: opinion, experience, or fact.\n
Definitions:\n- opinion: subjective beliefs, views, preferences without objective evidence.\n- experience: personal experience, anecdote, observation from the author's own life.\n- fact: verifiable claim about the world that could be checked against a reliable source.\n
If the text mixes types, choose the dominant one.\nReturn claimType and a confidence (0..1).\n
Topic (optional): {{{topic}}}\nStatement: {{{text}}}`,
});

const classifyClaimTypeFlow = ai.defineFlow(
  {
    name: 'classifyClaimTypeFlow',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

