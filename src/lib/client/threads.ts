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
  aiAssisted?: boolean;
}): Promise<ThreadNode> {
  // Use API route to enforce server-side gates
  const token = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
  // Optional App Check token if configured
  let appCheckToken: string | undefined = undefined;
  try {
    const { getToken } = await import('firebase/app-check');
    const r = await getToken(undefined as any, false);
    appCheckToken = r?.token;
  } catch {}
  const res = await fetch('/api/threads/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify({
      topicId: data.topicId,
      statementId: data.statementId,
      statementAuthorId: data.statementAuthorId,
      parentId: data.parentId,
      content: data.content,
      type: data.type,
      aiAssisted: !!data.aiAssisted,
    }),
  });
  if (!res.ok) {
    let code: string | undefined;
    try { const j = await res.json(); code = j?.error; } catch {}
    const err: any = new Error('create-thread-failed');
    err.code = code || `http_${res.status}`;
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  logger.info('Thread node created:', json.id);
  return { id: json.id, ...data, createdAt: new Date().toISOString() } as any;
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
