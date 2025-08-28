// Client-only Firestore helpers for statements
// Used by client components to avoid importing server stubs.

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

export async function checkIfUserHasPostedStatement(userId: string, topicId: string): Promise<boolean> {
  const q = query(
    collection(db, 'topics', topicId, 'statements'),
    where('createdBy', '==', userId),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function createStatement(
  topicId: string,
  userId: string,
  content: string,
  claimType: 'opinion' | 'experience' | 'fact',
  sourceUrl?: string,
  aiAssisted?: boolean,
  userName?: string,
  userPhotoURL?: string
) {
  // Use API route to enforce server-side gates
  const token = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
  // Optional App Check token if configured
  let appCheckToken: string | undefined = undefined;
  try {
    const { getToken } = await import('firebase/app-check');
    const r = await getToken(undefined as any, false);
    appCheckToken = r?.token;
  } catch {}
  const res = await fetch('/api/statements/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify({ topicId, content, claimType, sourceUrl, aiAssisted }),
  });
  if (!res.ok) {
    let code: string | undefined;
    try { const j = await res.json(); code = j?.error; } catch {}
    const err: any = new Error('create-statement-failed');
    err.code = code || `http_${res.status}`;
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  logger.info('Statement created:', json.id);
  return { id: json.id, topicId, content, createdBy: userId, position: 'pending', claimType, ...(sourceUrl ? { sourceUrl } : {}), ...(aiAssisted ? { aiAssisted: true } : {}) };
}
