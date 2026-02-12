import { NextResponse } from 'next/server';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { getDbAdmin } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

function toIso(ts: any): string | null {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (typeof ts === 'string') return ts;
    if (ts?.seconds !== undefined) return new Date(ts.seconds * 1000).toISOString();
  } catch {}
  return null;
}

export const POST = withAuth(
  async (req, ctx: any) => {
    try {
      if (!globalRateLimiter.check(getClientKey(req))) {
        return NextResponse.json({ success: false, reason: 'rate_limited' }, { status: 429 });
      }

      const uid = String(ctx?.uid || '');
      const approved = !!ctx?.kycVerified;

      let provider: string | null = null;
      let verifiedAt: string | null = null;
      try {
        const snap = await getDbAdmin().collection('users').doc(uid).get();
        const data = snap.exists ? ((snap.data() as any) || {}) : {};
        provider = String(data?.personhood?.provider || '') || null;
        verifiedAt = toIso(data?.personhood?.verifiedAt || data?.verifiedAt);
      } catch {}

      return NextResponse.json({
        success: true,
        approved,
        reason: approved ? null : 'not_verified',
        provider,
        verifiedAt,
      });
    } catch {
      return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
    }
  },
  {
    ...requireStatus(['Grace', 'Verified']),
    rateLimit: { userPerMin: 6, ipPerMin: 60 },
    idempotent: true,
  }
);
