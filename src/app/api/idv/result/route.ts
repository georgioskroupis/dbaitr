import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { setClaims } from '@/lib/authz/claims';

export const runtime = 'nodejs';

// This endpoint is called by the IdvWizard component to store the result of the verification
// and approve the user if the verification was successful.
export const POST = withAuth(async (ctx, req) => {
  try {
    // Rate limit result posting per client
    if (!globalRateLimiter.check(getClientKey(req))) {
      return NextResponse.json({ success: false, reason: 'rate_limited' }, { status: 429 });
    }
    const uid = ctx?.uid as string;

    const { approved, reason } = await req.json();

    const db = getDbAdmin();
    if (!db) {
      throw new Error('Firestore not initialized');
    }

    // Store the verification attempt with server timestamp
    const attemptRef = db.collection('idv_attempts').doc();
    await attemptRef.set({
      uid,
      approved: !!approved,
      reason: reason || null,
      timestamp: FieldValue.serverTimestamp(),
    });

    // If approved, update the user's profile
    if (approved) {
      const userRef = db.collection('users').doc(uid);
      // Merge verification flags expected by the client and retain backward-compatible fields
      await userRef.set(
        {
          kycVerified: true,
          identity: { verified: true },
          idv_verified: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      // Claims: Verified
      await setClaims(uid, { status: 'Verified', kycVerified: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling IDV result:', error);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
