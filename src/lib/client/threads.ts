// Client-only Firestore helpers for threads
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import type { ThreadNode } from '@/types';

export async function createThreadNode(data: {
  topicId: string;
  statementId: string;
  statementAuthorId: string;
  parentId: string | null;
  content: string;
  createdBy: string;
  type: 'question' | 'response';
}): Promise<ThreadNode> {
  const payload: any = {
    topicId: data.topicId,
    statementId: data.statementId,
    statementAuthorId: data.statementAuthorId,
    parentId: data.parentId || null,
    content: data.content,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    type: data.type,
  };
  const ref = await addDoc(
    collection(db, 'topics', data.topicId, 'statements', data.statementId, 'threads'),
    payload
  );
  logger.info('Thread node created:', ref.id);
  return { id: ref.id, ...payload } as ThreadNode;
}

export async function getUserQuestionCountForStatement(userId: string, statementId: string, topicId: string): Promise<number> {
  const q = query(
    collection(db, 'topics', topicId, 'statements', statementId, 'threads'),
    where('createdBy', '==', userId),
    where('type', '==', 'question')
  );
  const snap = await getDocs(q);
  return snap.size;
}

