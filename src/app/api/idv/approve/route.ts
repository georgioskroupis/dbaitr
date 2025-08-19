import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getAuthAdmin } from '@/lib/firebaseAdmin';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    if (!auth) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const hdr = req.headers.get('authorization') || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: 'no_token' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    try { await auth.setCustomUserClaims(uid, { ...(decoded as any).claims, idVerified: true }); } catch {}
    const db = getFirestore();
    await db.collection('users').doc(uid).set({ identity: { verified: true } }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
