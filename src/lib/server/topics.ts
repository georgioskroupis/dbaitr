"use server";

import type { Topic, Statement } from '@/types';
import { getDbAdmin } from '@/lib/firebaseAdmin';

function toISO(ts: any): string | undefined {
  try {
    if (!ts) return undefined;
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (ts.seconds !== undefined && ts.nanoseconds !== undefined) {
      const d = new Date(ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1e6));
      return d.toISOString();
    }
    if (ts instanceof Date) return ts.toISOString();
  } catch {}
  return undefined;
}

export async function getTopicByIdServer(topicId: string): Promise<Topic | null> {
  const db = getDbAdmin();
  if (!db) return null;
  const snap = await db.collection('topics').doc(topicId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    id: snap.id,
    ...(data as any),
    createdAt: toISO((data as any).createdAt) || (data as any).createdAt,
    updatedAt: toISO((data as any).updatedAt) || (data as any).updatedAt,
  } as Topic;
}

export async function getStatementsForTopicServer(topicId: string): Promise<Statement[]> {
  const db = getDbAdmin();
  if (!db) return [];
  const snap = await db
    .collection('topics')
    .doc(topicId)
    .collection('statements')
    .orderBy('createdAt', 'asc')
    .get();
  return snap.docs.map((d) => {
    const data = d.data() || {};
    const st = {
      id: d.id,
      ...(data as any),
      createdAt: toISO((data as any).createdAt) || (data as any).createdAt,
      lastEditedAt: toISO((data as any).lastEditedAt) || (data as any).lastEditedAt,
    } as Statement;
    // Normalize nested sentiment.updatedAt if present
    if ((st as any).sentiment && (st as any).sentiment.updatedAt) {
      const u = (st as any).sentiment.updatedAt as any;
      (st as any).sentiment.updatedAt = toISO(u) || u;
    }
    return st;
  });
}

