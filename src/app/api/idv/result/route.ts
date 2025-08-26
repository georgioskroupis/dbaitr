import { NextResponse } from 'next/server';
import { getDbAdmin, getAuthAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

// This endpoint is called by the IdvWizard component to store the result of the verification
// and approve the user if the verification was successful.
export async function POST(req: Request) {
  try {
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

    // Store the verification attempt
    const attemptRef = db.collection('idv_attempts').doc();
    await attemptRef.set({
      uid,
      approved,
      reason,
      timestamp: new Date(),
    });

    // If approved, update the user's profile
    if (approved) {
      const userRef = db.collection('users').doc(uid);
      await userRef.update({
        idv_verified: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling IDV result:', error);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}
