import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';
import { withAuth, requireStatus } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

// Optional client acknowledgement endpoint.
// Final approval is decided server-side in /api/idv/verify.
export const POST = withAuth(async (req, ctx: any) => {
  try {
    // Rate limit result posting per client
    if (!globalRateLimiter.check(getClientKey(req))) {
      return NextResponse.json({ success: false, reason: 'rate_limited' }, { status: 429 });
    }
    const uid = ctx?.uid as string;

    const { reason } = await req.json().catch(() => ({}));

    const db = getDbAdmin();
    const latestSnap = await db.collection('idv_latest').doc(uid).get();
    const latest = latestSnap.exists ? (latestSnap.data() as any) : null;

    // Audit client acknowledgement only. Approval is decided server-side in /api/idv/verify.
    await db.collection('idv_attempts').add({
      uid,
      approved: !!latest?.approved,
      reason: latest?.reason || null,
      clientReason: reason || null,
      source: 'client_ack',
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      approved: !!latest?.approved,
      reason: latest?.reason || null,
    });
  } catch (error) {
    console.error('Error handling IDV result:', error);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']), rateLimit: { userPerMin: 6, ipPerMin: 60 }, idempotent: true });
