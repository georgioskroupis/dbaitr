import { config } from 'dotenv';
config();

import '@/ai/flows/classify-post-position.ts';
import '@/ai/flows/generate-topic-analysis.ts';
import '@/ai/flows/prevent-duplicate-topics.ts';
import '@/ai/flows/find-similar-topics.ts';