"use server";

// Server-safe stub to avoid importing client Firebase SDK during build.
// Use Admin helpers in '@/lib/server/*' or API routes instead of this module.

import type { Topic, Statement, UserProfile, ThreadNode } from '@/types';
import { logger } from '@/lib/logger';

function notAvailable(name: string): never {
  const msg = `[firestoreActions] '${name}' is disabled in server build. Use Admin helpers (lib/server) or API routes.`;
  logger.error(msg);
  throw new Error(msg);
}

export async function createUserProfile(userId: string, email: string | null, fullNameFromAuth: string | null, providerIdFromAuth?: string): Promise<UserProfile | null> { return notAvailable('createUserProfile'); }
export async function getUserProfile(userId: string): Promise<UserProfile | null> { return notAvailable('getUserProfile'); }
export async function updateUserVerificationStatus(userId: string, idDocumentUrl: string): Promise<void> { return notAvailable('updateUserVerificationStatus'); }
export async function createTopic(title: string, initialDescription: string | undefined, userId: string): Promise<Topic> { return notAvailable('createTopic'); }
export async function createStatement(topicId: string, userId: string, content: string, userName?: string, userPhotoURL?: string): Promise<Statement> { return notAvailable('createStatement'); }
export async function getTopics(): Promise<Topic[]> { return notAvailable('getTopics'); }
export async function getTopicById(topicId: string): Promise<Topic | null> { return notAvailable('getTopicById'); }
export async function getTopicByTitle(title: string): Promise<Topic | null> { return notAvailable('getTopicByTitle'); }
export async function getStatementsForTopic(topicId: string): Promise<Statement[]> { return notAvailable('getStatementsForTopic'); }
export async function checkIfUserHasPostedStatement(userId: string, topicId: string): Promise<boolean> { return notAvailable('checkIfUserHasPostedStatement'); }
export async function getAllTopicTitles(): Promise<string[]> { return notAvailable('getAllTopicTitles'); }
export async function updateTopicDescriptionWithAISummary(topicId: string, summary: string): Promise<void> { return notAvailable('updateTopicDescriptionWithAISummary'); }
export async function updateStatementPosition(topicId: string, statementId: string, newPosition: 'for' | 'against' | 'neutral', oldPosition?: 'for' | 'against' | 'neutral' | 'pending'): Promise<void> { return notAvailable('updateStatementPosition'); }
export async function createThreadNode(data: { topicId: string; statementId: string; statementAuthorId: string; parentId: string | null; content: string; createdBy: string; type: 'question' | 'response'; }): Promise<ThreadNode> { return notAvailable('createThreadNode'); }
export async function getThreadsForStatement(topicId: string, statementId: string): Promise<ThreadNode[]> { return notAvailable('getThreadsForStatement'); }
export async function getUserQuestionCountForStatement(userId: string, statementId: string, topicId: string): Promise<number> { return notAvailable('getUserQuestionCountForStatement'); }

