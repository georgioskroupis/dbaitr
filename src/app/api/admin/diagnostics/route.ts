export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const GET = withAuth(async (_ctx, _req) => {
  const db = getDbAdmin();
  const snap = await db.collection('_diagnostics').doc('auth').collection('denials').orderBy('at', 'desc').limit(50).get();
  const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ ok: true, items });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });

