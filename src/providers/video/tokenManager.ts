import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';

const PATH = { col: '_private', doc: 'youtubeTokens', sub: 'global', id: 'host' } as const;

type CredDoc = {
  refreshToken?: string | null;
  accessToken?: string | null;
  expiryDate?: number | null;
  channelId?: string | null;
  channelTitle?: string | null;
  userId?: string | null;
  status?: 'ok' | 'invalid';
  invalidAt?: any;
  lastRefreshOkAt?: any;
  lastValidateOkAt?: any;
};

export async function getGlobalCreds(): Promise<{
  hasRefresh: boolean;
  refreshToken?: string | null;
  accessToken?: string | null;
  expiryDate?: number | null;
  channelId?: string | null;
  channelTitle?: string | null;
  userId?: string | null;
  status?: 'ok' | 'invalid';
}> {
  const db = getDbAdmin();
  const ref = db.collection(PATH.col).doc(PATH.doc).collection(PATH.sub).doc(PATH.id);
  const snap = await ref.get();
  const d = (snap.exists ? (snap.data() as CredDoc) : {}) || {};
  return {
    hasRefresh: !!d.refreshToken,
    refreshToken: d.refreshToken || null,
    accessToken: d.accessToken || null,
    expiryDate: d.expiryDate || null,
    channelId: d.channelId || null,
    channelTitle: d.channelTitle || null,
    userId: d.userId || null,
    status: d.status || 'ok',
  };
}

export async function saveAccessToken(input: { accessToken?: string | null; expiryDate?: number | null }) {
  const db = getDbAdmin();
  const ref = db.collection(PATH.col).doc(PATH.doc).collection(PATH.sub).doc(PATH.id);
  const update: Partial<CredDoc> = {
    ...(input.accessToken ? { accessToken: input.accessToken } : {}),
    ...(typeof input.expiryDate === 'number' ? { expiryDate: input.expiryDate } : {}),
    lastRefreshOkAt: FieldValue.serverTimestamp(),
    status: 'ok',
  };
  await ref.set(update, { merge: true });
}

export async function saveRefreshTokenIfPresent(input: { refreshToken?: string | null; channelId?: string | null; channelTitle?: string | null; userId?: string | null }) {
  if (!input?.refreshToken && input.refreshToken !== undefined) {
    return; // do not overwrite with undefined/null
  }
  const db = getDbAdmin();
  const ref = db.collection(PATH.col).doc(PATH.doc).collection(PATH.sub).doc(PATH.id);
  const update: Partial<CredDoc> = {
    ...(input.refreshToken ? { refreshToken: input.refreshToken } : {}),
    ...(input.channelId !== undefined ? { channelId: input.channelId || null } : {}),
    ...(input.channelTitle !== undefined ? { channelTitle: input.channelTitle || null } : {}),
    ...(input.userId !== undefined ? { userId: input.userId || null } : {}),
    status: 'ok',
  };
  await ref.set(update, { merge: true });
}

export async function markInvalid() {
  const db = getDbAdmin();
  const ref = db.collection(PATH.col).doc(PATH.doc).collection(PATH.sub).doc(PATH.id);
  await ref.set({ status: 'invalid', invalidAt: FieldValue.serverTimestamp() } as Partial<CredDoc>, { merge: true });
}

export async function setLastValidateOkAt() {
  const db = getDbAdmin();
  const ref = db.collection(PATH.col).doc(PATH.doc).collection(PATH.sub).doc(PATH.id);
  await ref.set({ lastValidateOkAt: FieldValue.serverTimestamp(), status: 'ok' } as Partial<CredDoc>, { merge: true });
}

export async function purge() {
  const db = getDbAdmin();
  await db.collection(PATH.col).doc(PATH.doc).collection(PATH.sub).doc(PATH.id).delete();
}

