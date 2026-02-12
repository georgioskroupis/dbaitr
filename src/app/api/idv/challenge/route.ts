import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { getClientKey, globalRateLimiter } from '@/lib/rateLimit';
import { hashChallenge, startSelfVerificationSession } from '@/lib/idv/personhood';

export const runtime = 'nodejs';

const DEFAULT_CHALLENGE_TTL_MS = 10 * 60 * 1000;

function challengeTtlMs(): number {
  const raw = Number(process.env.IDV_CHALLENGE_TTL_MS || DEFAULT_CHALLENGE_TTL_MS);
  if (!Number.isFinite(raw)) return DEFAULT_CHALLENGE_TTL_MS;
  if (raw < 60_000) return 60_000;
  if (raw > 60 * 60 * 1000) return 60 * 60 * 1000;
  return Math.floor(raw);
}

export const POST = withAuth(
  async (req, ctx: any) => {
    try {
      if (!globalRateLimiter.check(getClientKey(req))) {
        return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
      }

      const uid = String(ctx?.uid || '');
      if (!uid) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

      const ttlMs = challengeTtlMs();
      const nowMs = Date.now();
      const challengeId = crypto.randomUUID();
      const challenge = crypto.randomBytes(24).toString('base64url');
      const challengeHash = hashChallenge(challenge);
      const expiresAtMs = nowMs + ttlMs;

      const db = getDbAdmin();
      await db
        .collection('_private')
        .doc('idv')
        .collection('challenges')
        .doc(challengeId)
        .set(
          {
            uid,
            provider: 'self_openpassport',
            challengeHash,
            createdAt: FieldValue.serverTimestamp(),
            expiresAtMs,
            status: 'issued',
          },
          { merge: false }
        );

      const session = await startSelfVerificationSession({
        uid,
        challengeId,
        challenge,
        expiresAtMs,
      });

      return NextResponse.json({
        ok: true,
        provider: 'self_openpassport',
        challengeId,
        challenge,
        expiresAtMs,
        verificationUrl: session.verificationUrl,
        sessionId: session.sessionId,
      });
    } catch {
      return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
    }
  },
  { ...requireStatus(['Grace', 'Verified']), rateLimit: { userPerMin: 6, ipPerMin: 60 } }
);
