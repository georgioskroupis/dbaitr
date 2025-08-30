// Client-only Firestore helpers for topics
import { getDb } from '@/lib/firebase/client';
import { logger } from '@/lib/logger';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Topic } from '@/types';

export async function createTopic(title: string, initialDescription: string | undefined, userId: string): Promise<Topic> {
  const payload: any = {
    title,
    description: initialDescription || '',
    createdBy: userId,
    createdAt: serverTimestamp(),
    scoreFor: 0,
    scoreAgainst: 0,
    scoreNeutral: 0,
  };
  const ref = await addDoc(collection(getDb(), 'topics'), payload);
  logger.info('Topic created:', ref.id);
  // Return minimal Topic; timestamps will be normalized by readers
  return {
    id: ref.id,
    ...payload,
  } as Topic;
}

export async function updateTopicDescriptionWithAISummary(topicId: string, summary: string): Promise<void> {
  await updateDoc(doc(getDb(), 'topics', topicId), {
    description: summary,
    updatedAt: serverTimestamp(),
  });
}
