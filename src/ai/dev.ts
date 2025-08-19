import { config } from 'dotenv';
config();

import '@/ai/flows/classify-post-position.ts';
import '@/ai/flows/generate-topic-analysis.ts';
import '@/ai/flows/find-similar-topics.ts'; // Updated from prevent-duplicate-topics
// Removed old prevent-duplicate-topics import if it was separate
