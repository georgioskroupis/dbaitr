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
  userName?: string,
  userPhotoURL?: string
) {
  const payload: any = {
    topicId,
    content,
    createdBy: userId,
    createdAt: serverTimestamp(),
    position: 'pending',
    claimType,
  };
  if (claimType === 'fact' && sourceUrl) payload.sourceUrl = sourceUrl;
  if (userName) payload.userName = userName;
  if (userPhotoURL) payload.userPhotoURL = userPhotoURL;
  const ref = await addDoc(collection(db, 'topics', topicId, 'statements'), payload);
  logger.info('Statement created:', ref.id);
  return { id: ref.id, ...payload };
}
