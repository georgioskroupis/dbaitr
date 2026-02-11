import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const POST = withAuth(async (req, ctx: any) => {
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;

    const body = await req.json();
    const { appealId, decision, rationale } = body || {};
    if (!appealId || !decision || !['approved', 'denied'].includes(decision)) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }
    await db.collection('appeals').doc(appealId).set({
      status: 'resolved',
      decision,
      rationale: rationale || '',
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: uid,
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireRole('moderator'), ...requireStatus(['Verified']) });
