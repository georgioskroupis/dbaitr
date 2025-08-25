'use server';

// Disabled in CI/server build to avoid client SDK imports. Use Admin tools or
// a protected backend endpoint to seed data if needed.
import { logger } from '@/lib/logger';

export async function seedMultiTopicTestData(): Promise<{ success: boolean; message: string }>{
  logger.warn('Seeding is disabled in this build.');
  return { success: false, message: 'Seeding disabled in server build.' };
}

