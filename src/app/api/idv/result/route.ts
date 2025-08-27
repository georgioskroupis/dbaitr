import { NextResponse } from 'next/server';
import { getDbAdmin, getAuthAdmin, FieldValue } from '@/lib/firebaseAdmin';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// This endpoint is called by the IdvWizard component to store the result of the verification
// and approve the user if the verification was successful.
export async function POST(req: Request) {
  try {
    // Rate limit result posting per client
    if (!globalRateLimiter.check(getClientKey(req))) {
      return NextResponse.json({ success: false, reason: 'rate_limited' }, { status: 429 });
    }
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ success: false, reason: 'unauthorized' }, { status: 401 });
    }

    const auth = getAuthAdmin();
    if (!auth) {
      throw new Error('Auth not initialized');
    }
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

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
      // Set a custom claim to allow server-side gating if needed
      const auth = getAuthAdmin();
      try { await auth?.setCustomUserClaims(uid, { idVerified: true }); } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling IDV result:', error);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}
