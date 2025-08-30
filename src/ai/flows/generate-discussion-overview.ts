'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const QuoteSchema = z.object({ text: z.string(), messageId: z.string() });
const EvidenceSchema = z.object({ title: z.string().optional(), url: z.string().optional(), messageId: z.string().optional(), domainWeight: z.number().optional() });

const SideSchema = z.object({
  summary: z.string(),
  topPoints: z.array(z.string()),
  quotes: z.array(QuoteSchema),
  evidence: z.array(EvidenceSchema),
  unresolved: z.array(z.string()),
});

const OutputSchema = z.object({
  meta: z.object({ confidence: z.number().min(0).max(1).optional() }).optional(),
  for: SideSchema,
  against: SideSchema,
  rationaleShort: z.string().optional(),
});

const InputSchema = z.object({
  digest: z.object({
    topic: z.string(),
    for: z.array(z.object({ id: z.string(), text: z.string() })),
    against: z.array(z.object({ id: z.string(), text: z.string() })),
    neutral: z.array(z.object({ id: z.string(), text: z.string() })),
    evidence: z.object({
      for: z.array(z.object({ url: z.string(), messageId: z.string(), domainWeight: z.number().optional() })),
      against: z.array(z.object({ url: z.string(), messageId: z.string(), domainWeight: z.number().optional() })),
    }),
  })
});

export type GenerateDiscussionOverviewInput = z.infer<typeof InputSchema>;
export type GenerateDiscussionOverviewOutput = z.infer<typeof OutputSchema>;

export async function generateDiscussionOverview(input: GenerateDiscussionOverviewInput): Promise<GenerateDiscussionOverviewOutput> {
  return flow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDiscussionOverviewPrompt',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `You are generating an AI Discussion Overview for a debate topic.
Topic: {{digest.topic}}

You are given excerpts grouped by stance:
- FOR: {{#each digest.for}}{{id}}: {{text}}\n{{/each}}
- AGAINST: {{#each digest.against}}{{id}}: {{text}}\n{{/each}}
- NEUTRAL/MIXED: {{#each digest.neutral}}{{id}}: {{text}}\n{{/each}}

Evidence links that appear in the thread:
- FOR: {{#each digest.evidence.for}}{{url}} ({{messageId}})\n{{/each}}
- AGAINST: {{#each digest.evidence.against}}{{url}} ({{messageId}})\n{{/each}}

Rules:
- Summarize positions that appear in the excerpts; do not invent facts.
- Frame statements with neutral language ("participants argue", "opponents contend").
- Produce quotes ≤ 20 words with message anchors.
- Evidence must come from the provided links; include up to 5 per side.
- If unclear or sparse, keep confidence low.
- Unresolved questions derive from neutral/mixed content or conflicting points.

Return strict JSON for fields: meta.confidence (0..1), for { summary, topPoints (3-5), quotes (2-3), evidence (0-5), unresolved (0-3) }, against { same }, rationaleShort (brief).
`,
});

const flow = ai.defineFlow({
  name: 'generateDiscussionOverviewFlow',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
}, async (input) => {
  const { output } = await prompt(input);
  return output!;
});

