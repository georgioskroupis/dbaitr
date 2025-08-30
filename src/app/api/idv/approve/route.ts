import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { setClaims } from '@/lib/authz/claims';

export const POST = withAuth(async (ctx, _req) => {
  try {
    const uid = ctx?.uid as string;
    const db = getDbAdmin();
    await setClaims(uid, { status: 'Verified', kycVerified: true });
    await db.collection('users').doc(uid).set({ identity: { verified: true }, kycVerified: true, updatedAt: new Date() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
