'use server';

/**
 * @fileOverview Generates a neutral analysis of a debate topic using AI.
 *
 * - generateTopicAnalysis - A function that generates the topic analysis.
 * - GenerateTopicAnalysisInput - The input type for the generateTopicAnalysis function.
 * - GenerateTopicAnalysisOutput - The return type for the generateTopicAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTopicAnalysisInputSchema = z.object({
  topic: z.string().describe('The debate topic to analyze.'),
});
export type GenerateTopicAnalysisInput = z.infer<
  typeof GenerateTopicAnalysisInputSchema
>;

const GenerateTopicAnalysisOutputSchema = z.object({
  analysis: z.string().describe('A neutral analysis of the debate topic.'),
});
export type GenerateTopicAnalysisOutput = z.infer<
  typeof GenerateTopicAnalysisOutputSchema
>;

export async function generateTopicAnalysis(
  input: GenerateTopicAnalysisInput
): Promise<GenerateTopicAnalysisOutput> {
  return generateTopicAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTopicAnalysisPrompt',
  input: {schema: GenerateTopicAnalysisInputSchema},
  output: {schema: GenerateTopicAnalysisOutputSchema},
  prompt: `You are an expert in providing neutral analyses of debate topics.

  Provide a brief, neutral overview of the following debate topic. Do not take a position for or against the topic.

  Topic: {{{topic}}}`,
});

const generateTopicAnalysisFlow = ai.defineFlow(
  {
    name: 'generateTopicAnalysisFlow',
    inputSchema: GenerateTopicAnalysisInputSchema,
    outputSchema: GenerateTopicAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
