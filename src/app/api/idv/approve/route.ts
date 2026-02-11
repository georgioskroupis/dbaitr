import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';
import { setClaims } from '@/lib/authz/claims';

export const POST = withAuth(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = String(body?.uid || '').trim();
    if (!uid) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const db = getDbAdmin();
    await setClaims(uid, { status: 'Verified', kycVerified: true });
    await db.collection('users').doc(uid).set({
      identity: { verified: true },
      kycVerified: true,
      idv_verified: true,
      status: 'verified',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('idv_latest').doc(uid).set({
      approved: true,
      reason: 'manual_admin_approve',
      source: 'admin',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('idv_attempts').add({
      uid,
      approved: true,
      reason: 'manual_admin_approve',
      source: 'admin',
      timestamp: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
