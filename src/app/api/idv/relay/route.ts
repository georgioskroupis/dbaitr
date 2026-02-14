import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { setClaims } from '@/lib/authz/claims';
import { getClientKey, globalRateLimiter } from '@/lib/rateLimit';
import {
  hashChallenge,
  hashNullifierForDedup,
  verifySelfRelayPayload,
} from '@/lib/idv/personhood';

export const runtime = 'nodejs';

class AppCodeError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

function reasonToStatus(reason: string): number {
  if (reason === 'verification_unavailable') return 503;
  if (reason === 'invalid_challenge') return 400;
  if (reason === 'invalid_payload') return 400;
  if (reason === 'invalid_proof') return 400;
  if (reason === 'verification_failed') return 400;
  return 400;
}

export async function POST(req: Request) {
  try {
    if (!globalRateLimiter.check(getClientKey(req))) {
      return NextResponse.json({ ok: false, approved: false, reason: 'rate_limited' }, { status: 429 });
    }

    const payload = await req.json().catch(() => ({}));
    const provider = await verifySelfRelayPayload(payload);
    if (!provider.ok) {
      return NextResponse.json(
        { ok: false, approved: false, reason: provider.reason },
        { status: reasonToStatus(provider.reason) }
      );
    }

    const db = getDbAdmin();
    const challengeRef = db.collection('_private').doc('idv').collection('challenges').doc(provider.challengeId);
    const challengeSnap = await challengeRef.get();
    if (!challengeSnap.exists) {
      return NextResponse.json({ ok: false, approved: false, reason: 'invalid_challenge' }, { status: 400 });
    }
    const challengeDoc = (challengeSnap.data() as any) || {};
    const uid = String(challengeDoc.uid || '');
    if (!uid) {
      return NextResponse.json({ ok: false, approved: false, reason: 'invalid_challenge' }, { status: 400 });
    }

    if (challengeDoc.usedAt) {
      // Relayer retries are expected; a previously finalized challenge is a success state.
      return NextResponse.json({ ok: true, approved: true, reason: null, provider: 'self_openpassport' });
    }
    if (typeof challengeDoc.expiresAtMs === 'number' && Date.now() > challengeDoc.expiresAtMs) {
      return NextResponse.json({ ok: false, approved: false, reason: 'challenge_expired' }, { status: 409 });
    }
    if (String(challengeDoc.challengeHash || '') !== hashChallenge(provider.challenge)) {
      return NextResponse.json({ ok: false, approved: false, reason: 'invalid_challenge' }, { status: 400 });
    }

    let dedupHash = '';
    try {
      dedupHash = hashNullifierForDedup(provider.nullifier);
    } catch {
      return NextResponse.json(
        { ok: false, approved: false, reason: 'verification_unavailable' },
        { status: 503 }
      );
    }

    const dedupRef = db.collection('_private').doc('idv').collection('nullifierHashes').doc(dedupHash);

    try {
      await db.runTransaction(async (tx) => {
        const [challengeCurrent, dedupSnap] = await Promise.all([tx.get(challengeRef), tx.get(dedupRef)]);
        if (!challengeCurrent.exists) throw new AppCodeError(400, 'invalid_challenge');

        const current = (challengeCurrent.data() as any) || {};
        if (String(current.uid || '') !== uid) throw new AppCodeError(400, 'invalid_challenge');
        if (current.usedAt) throw new AppCodeError(409, 'challenge_used');
        if (typeof current.expiresAtMs === 'number' && Date.now() > current.expiresAtMs) {
          throw new AppCodeError(409, 'challenge_expired');
        }
        if (String(current.challengeHash || '') !== hashChallenge(provider.challenge)) {
          throw new AppCodeError(400, 'invalid_challenge');
        }

        if (dedupSnap.exists) {
          const ownerUid = String(((dedupSnap.data() as any) || {}).uid || '');
          if (ownerUid && ownerUid !== uid) {
            throw new AppCodeError(409, 'duplicate_identity');
          }
        }

        const dedupPayload: Record<string, unknown> = {
          uid,
          provider: 'self_openpassport',
          assuranceLevel: provider.assuranceLevel,
          attestationType: provider.attestationType,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!dedupSnap.exists) dedupPayload.createdAt = FieldValue.serverTimestamp();

        tx.set(dedupRef, dedupPayload, { merge: true });
        tx.set(
          challengeRef,
          {
            status: 'verified',
            usedAt: FieldValue.serverTimestamp(),
            usedByUid: uid,
            provider: 'self_openpassport',
          },
          { merge: true }
        );
      });
    } catch (error: any) {
      if (error instanceof AppCodeError) {
        if (error.code === 'challenge_used') {
          return NextResponse.json({ ok: true, approved: true, reason: null, provider: 'self_openpassport' });
        }
        return NextResponse.json(
          { ok: false, approved: false, reason: error.code },
          { status: error.status }
        );
      }
      return NextResponse.json({ ok: false, approved: false, reason: 'server_error' }, { status: 500 });
    }

    try {
      await setClaims(uid, { status: 'Verified', kycVerified: true });
    } catch {
      await challengeRef.set(
        {
          status: 'claims_sync_failed',
          claimsSyncFailedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ ok: false, approved: false, reason: 'server_error' }, { status: 500 });
    }

    await db.collection('users').doc(uid).set(
      {
        kycVerified: true,
        status: 'verified',
        verifiedAt: FieldValue.serverTimestamp(),
        personhood: {
          provider: 'self_openpassport',
          dedupHash,
          assuranceLevel: provider.assuranceLevel,
          attestationType: provider.attestationType,
          verifiedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, approved: true, reason: null, provider: 'self_openpassport' });
  } catch {
    return NextResponse.json({ ok: false, approved: false, reason: 'server_error' }, { status: 500 });
  }
}
