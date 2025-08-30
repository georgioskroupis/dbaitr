import { getAuthAdmin, getDbAdmin } from '@/lib/firebase/admin';
import type { Role, Status } from './types';

export async function setClaims(uid: string, claims: { role?: Role; status?: Status; kycVerified?: boolean }) {
  const auth = getAuthAdmin();
  const existing = (await auth.getUser(uid)).customClaims || {};
  await auth.setCustomUserClaims(uid, { ...existing, ...claims });
  await forceRefreshClaims(uid);
}

export async function forceRefreshClaims(uid: string) {
  // Signal clients to refresh tokens by bumping a timestamp in user_private
  const db = getDbAdmin();
  await db.collection('user_private').doc(uid).set({ claimsChangedAt: new Date().toISOString() }, { merge: true });
}

